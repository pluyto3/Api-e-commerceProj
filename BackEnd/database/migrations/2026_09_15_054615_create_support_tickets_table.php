<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id('support_ticket_id');

            $table->string('ticket_number', 40)->unique();

            // Logged-in customer, if applicable
            $table->unsignedBigInteger('user_id')->nullable()->index();

            // Order/checkout reference, if applicable
            $table->unsignedBigInteger('order_id')->nullable()->index();

            $table->string('name', 100);
            $table->string('email', 150);

            $table->string('category', 50);

            $table->string('subject', 150);
            $table->text('message');

            $table->string('status', 30)->default('open');
            $table->string('priority', 20)->default('normal');

            $table->timestamp('email_sent_at')->nullable();
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
    }
};
