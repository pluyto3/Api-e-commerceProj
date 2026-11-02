<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Bootstrap\RegisterProviders;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class LocationAuthorizationTest extends TestCase
{
    private User $owner;
    private User $otherUser;
    private Location $address;
    private Location $previousDefault;
    private Location $otherAddress;

    public function createApplication(): Application
    {
        $app = require __DIR__.'/../../bootstrap/app.php';

        // Refuse cached configuration before Laravel can load it or boot providers.
        if ($app->configurationIsCached()) {
            throw new RuntimeException('SYS-001 tests require uncached test configuration.');
        }

        $app->beforeBootstrapping(RegisterProviders::class, function (Application $app) {
            $config = $app['config'];
            $connection = $config->get('database.connections.mysql', []);
            $approvedDatabase = env('SYS001_TEST_DATABASE');

            // An explicit opt-in follows owner approval and external isolation verification.
            // No connection, migration, or fixture write is allowed before these checks.
            if (
                realpath($app->basePath()) !== realpath(__DIR__.'/../..')
                || !$app->environment('testing')
                || $config->get('database.default') !== 'mysql'
                || !is_string($approvedDatabase)
                || !preg_match('/\Ahanzgo_sys001_test_[a-z0-9_]+\z/', $approvedDatabase)
                || ($connection['driver'] ?? null) !== 'mysql'
                || ($connection['database'] ?? null) !== $approvedDatabase
                || !in_array($connection['host'] ?? null, ['127.0.0.1', '::1'], true)
                || !str_starts_with($connection['username'] ?? '', 'hanzgo_sys001_test')
                || !empty($connection['url'])
                || !empty(env('DATABASE_URL'))
                || !empty($connection['unix_socket'])
                || !empty($connection['read'])
                || !empty($connection['write'])
                || !empty($connection['prefix'])
                || $config->get('cache.default') !== 'array'
                || $config->get('session.driver') !== 'array'
                || $config->get('mail.default') !== 'array'
                || $config->get('queue.default') !== 'sync'
            ) {
                throw new RuntimeException('SYS-001 tests require an approved, isolated local MySQL test connection; see docs/TESTING.md.');
            }
        });

        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();

        $database = DB::connection();
        $this->assertSame(env('SYS001_TEST_DATABASE'), $database->getConfig('database'));
        $this->assertSame(env('SYS001_TEST_DATABASE'), $database->selectOne('SELECT DATABASE() AS database_name')->database_name);
        foreach (['users', 'locations'] as $table) {
            $metadata = $database->selectOne(
                'SELECT ENGINE AS table_engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                [env('SYS001_TEST_DATABASE'), $table]
            );
            $this->assertSame('InnoDB', $metadata->table_engine ?? null, 'Fixture tables must support transaction rollback.');
        }
        $this->assertFalse(User::query()->exists(), 'The disposable test database must have no existing users.');
        $this->assertFalse(Location::query()->exists(), 'The disposable test database must have no existing addresses.');

        // No RefreshDatabase/migrations/seeders: the owner-approved schema must exist already.
        $database->beginTransaction();
        $this->beforeApplicationDestroyed(function () use ($database) {
            $database->rollBack();
            $database->disconnect();
        });

        $this->owner = $this->createSyntheticUser('owner');
        $this->otherUser = $this->createSyntheticUser('other');
        $this->address = $this->createAddress($this->owner);
        $this->previousDefault = $this->createAddress($this->owner, true);
        $this->otherAddress = $this->createAddress($this->otherUser, true);
    }

    public function test_owner_can_read_their_address_with_the_existing_response_shape(): void
    {
        $this->withToken($this->owner->token)
            ->getJson('/api/location/'.$this->address->location_id)
            ->assertOk()
            ->assertExactJson($this->address->toArray());
    }

    #[DataProvider('ownerUpdates')]
    public function test_owner_can_update_using_both_existing_routes(string $method, ?string $zipcode): void
    {
        $otherAddressBefore = $this->otherAddress->toArray();
        $payload = $this->editPayload();
        $payload['editZipcode'] = $zipcode;
        $payload['user_id'] = $this->otherUser->user_id;
        $payload['is_default'] = true;

        // account.js sends form data via POST; the API also exposes PUT.
        $response = $this->withToken($this->owner->token)
            ->withHeader('Accept', 'application/json')
            ->call($method, '/api/location/'.$this->address->location_id, $payload);

        $updated = $this->address->fresh();
        $response->assertOk()->assertExactJson([
            'message' => 'Location updated successfully',
            'location' => $updated->toArray(),
            'status' => 200,
        ]);
        $this->assertSame($this->owner->user_id, $updated->user_id);
        $this->assertSame('Updated synthetic purok', $updated->purok);
        $this->assertSame('Updated synthetic barangay', $updated->barangay);
        $this->assertSame('Updated synthetic city', $updated->city);
        $this->assertSame('Updated synthetic province', $updated->province);
        $this->assertSame($zipcode, $updated->zipcode);
        $this->assertFalse((bool) $updated->is_default);
        $this->assertSame($otherAddressBefore, $this->otherAddress->fresh()->toArray());
    }

    public static function ownerUpdates(): array
    {
        return [
            'PUT with zipcode' => ['PUT', '1234'],
            'POST with zipcode' => ['POST', '1234'],
            'PUT without zipcode' => ['PUT', null],
            'POST without zipcode' => ['POST', null],
        ];
    }

    public function test_owner_can_delete_their_address_with_the_existing_response(): void
    {
        $otherAddressBefore = $this->otherAddress->toArray();

        $this->withToken($this->owner->token)
            ->deleteJson('/api/location/'.$this->address->location_id)
            ->assertOk()
            ->assertContent('"Location Successfully Deleted!"');

        $this->assertDatabaseMissing('locations', ['location_id' => $this->address->location_id]);
        $this->assertSame($otherAddressBefore, $this->otherAddress->fresh()->toArray());
        $this->assertNotNull($this->previousDefault->fresh());
    }

    public function test_owner_can_set_default_without_changing_other_users_addresses(): void
    {
        $otherAddressBefore = $this->otherAddress->toArray();

        $this->withToken($this->owner->token)
            ->putJson('/api/location/'.$this->address->location_id.'/setDefaultAddress')
            ->assertOk()
            ->assertExactJson(['message' => 'Address set as default successfully']);

        $this->assertTrue((bool) $this->address->fresh()->is_default);
        $this->assertFalse((bool) $this->previousDefault->fresh()->is_default);
        $this->assertSame($otherAddressBefore, $this->otherAddress->fresh()->toArray());
    }

    #[DataProvider('addressOperations')]
    public function test_other_users_and_missing_addresses_receive_the_same_denial_without_changes(
        string $method, string $suffix, string $messageKey, string $message
    ): void {
        $before = $this->addressSnapshot();
        $headers = ['Authorization' => 'Bearer '.$this->otherUser->token];
        $payload = $this->editPayload() + ['user_id' => $this->otherUser->user_id];

        foreach ([$this->address->location_id, $this->otherAddress->location_id + 1000000] as $id) {
            $this->json($method, '/api/location/'.$id.$suffix, $payload, $headers)
                ->assertNotFound()
                ->assertExactJson([$messageKey => $message]);

            // Includes every address field, timestamps, ownership, and both users' defaults.
            $this->assertSame($before, $this->addressSnapshot());
        }
    }

    public static function addressOperations(): array
    {
        return [
            'read' => ['GET', '', 'message', 'Location not found'],
            'PUT update' => ['PUT', '', 'msg', 'Location not found.'],
            'POST update' => ['POST', '', 'msg', 'Location not found.'],
            'delete' => ['DELETE', '', 'msg', 'Location Not Found.'],
            'set default' => ['PUT', '/setDefaultAddress', 'msg', 'Location not found.'],
        ];
    }

    #[DataProvider('updateMethods')]
    public function test_foreign_address_is_denied_even_with_invalid_update_fields(string $method): void
    {
        $before = $this->addressSnapshot();

        $this->withToken($this->otherUser->token)
            ->json($method, '/api/location/'.$this->address->location_id, [])
            ->assertNotFound()
            ->assertExactJson(['msg' => 'Location not found.']);

        $this->assertSame($before, $this->addressSnapshot());
    }

    #[DataProvider('updateMethods')]
    public function test_owner_update_still_validates_required_fields_without_changes(string $method): void
    {
        $before = $this->addressSnapshot();

        $this->withToken($this->owner->token)
            ->json($method, '/api/location/'.$this->address->location_id, [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['editPurok', 'editBarangay', 'editCity', 'editProvince']);

        $this->assertSame($before, $this->addressSnapshot());
    }

    public static function updateMethods(): array
    {
        return ['PUT' => ['PUT'], 'POST' => ['POST']];
    }

    #[DataProvider('unauthenticatedOperations')]
    public function test_missing_or_invalid_authentication_is_rejected_without_changes(
        string $method, string $target, bool $invalidToken
    ): void {
        $before = $this->addressSnapshot();
        $path = '/api/location'.str_replace('{id}', (string) $this->address->location_id, $target);
        $headers = $invalidToken ? ['Authorization' => 'Bearer synthetic-invalid-token'] : [];

        $this->json($method, $path, $this->editPayload() + $this->createPayload(), $headers)
            ->assertStatus(400)
            ->assertExactJson(['msg' => $invalidToken ? 'Invalid Token.' : 'No Token Provided.']);

        $this->assertSame($before, $this->addressSnapshot());
    }

    public static function unauthenticatedOperations(): array
    {
        $operations = [
            'list' => ['GET', ''],
            'create' => ['POST', ''],
            'read' => ['GET', '/{id}'],
            'PUT update' => ['PUT', '/{id}'],
            'POST update' => ['POST', '/{id}'],
            'delete' => ['DELETE', '/{id}'],
            'set default' => ['PUT', '/{id}/setDefaultAddress'],
        ];
        $cases = [];
        foreach ($operations as $name => [$method, $target]) {
            $cases[$name.' missing token'] = [$method, $target, false];
            $cases[$name.' invalid token'] = [$method, $target, true];
        }

        return $cases;
    }

    public function test_owner_list_keeps_the_frontend_envelope_and_excludes_other_users(): void
    {
        $response = $this->withToken($this->owner->token)->getJson('/api/location');

        $response->assertOk()->assertJsonCount(2, 'data')->assertJsonStructure([
            'data' => [['location_id', 'user_id', 'purok', 'barangay', 'city', 'province', 'zipcode', 'is_default', 'fullname', 'phone_number']],
        ]);
        $ids = array_column($response->json('data'), 'location_id');
        $this->assertEqualsCanonicalizing([$this->address->location_id, $this->previousDefault->location_id], $ids);
        foreach ($response->json('data') as $location) {
            $this->assertSame($this->owner->user_id, $location['user_id']);
            $this->assertSame($this->owner->fullname, $location['fullname']);
            $this->assertSame($this->owner->phone_number, $location['phone_number']);
        }
    }

    public function test_owner_create_keeps_the_frontend_response_and_uses_the_token_owner(): void
    {
        $response = $this->withToken($this->owner->token)
            ->withHeader('Accept', 'application/json')
            ->post('/api/location', $this->createPayload() + ['user_id' => $this->otherUser->user_id]);

        $response->assertCreated()
            ->assertJsonPath('msg', 'New Location was successfully saved.')
            ->assertJsonPath('category.user_id', $this->owner->user_id)
            ->assertJsonStructure(['msg', 'category' => ['location_id', 'user_id', 'purok', 'barangay', 'city', 'province', 'zipcode']]);
        $this->assertDatabaseHas('locations', $this->createPayload() + [
            'location_id' => $response->json('category.location_id'),
            'user_id' => $this->owner->user_id,
        ]);
    }

    private function createSyntheticUser(string $label): User
    {
        $suffix = Str::lower(Str::random(12));

        // Required fields come from this application's migrations, not UserFactory.
        return User::create([
            'username' => 'sys001_'.$label.'_'.$suffix,
            'email' => $label.'.'.$suffix.'@example.invalid',
            'password' => Hash::make('synthetic-test-password'),
            'fullname' => 'SYS-001 synthetic '.$label,
            'phone_number' => 'synthetic-'.$suffix,
            'role' => 'user',
            'token' => Str::random(60),
        ]);
    }

    private function createAddress(User $user, bool $default = false): Location
    {
        return Location::create($this->createPayload() + [
            'user_id' => $user->user_id,
            'is_default' => $default,
        ])->refresh();
    }

    private function createPayload(): array
    {
        return [
            'purok' => 'Synthetic purok',
            'barangay' => 'Synthetic barangay',
            'city' => 'Synthetic city',
            'province' => 'Synthetic province',
            'zipcode' => '1234',
        ];
    }

    private function editPayload(): array
    {
        return [
            'editPurok' => 'Updated synthetic purok',
            'editBarangay' => 'Updated synthetic barangay',
            'editCity' => 'Updated synthetic city',
            'editProvince' => 'Updated synthetic province',
            'editZipcode' => '1234',
        ];
    }

    private function addressSnapshot(): array
    {
        return Location::orderBy('location_id')->get()->toArray();
    }
}
