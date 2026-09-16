<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_ticket_replies', function (Blueprint $table) {
            $table->id('support_ticket_reply_id');

            $table->unsignedBigInteger('support_ticket_id');

            // The logged-in account that sent the reply.
            // Nullable so the conversation history can still remain
            // even if the sender account is later unavailable.
            $table->unsignedBigInteger('sender_user_id')->nullable();

            // Designed so we can support customer replies later.
            $table->enum('sender_type', [
                'admin',
                'customer',
                'system',
            ])->default('admin');

            $table->text('message');

            // Set only when the reply email was successfully sent.
            $table->timestamp('email_sent_at')->nullable();

            $table->timestamps();

            $table->foreign('support_ticket_id')
                ->references('support_ticket_id')
                ->on('support_tickets')
                ->cascadeOnDelete();

            $table->foreign('sender_user_id')
                ->references('user_id')
                ->on('users')
                ->nullOnDelete();

            $table->index([
                'support_ticket_id',
                'created_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_replies');
    }
};