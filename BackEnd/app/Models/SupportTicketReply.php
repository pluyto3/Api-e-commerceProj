<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupportTicketReply extends Model
{
    use HasFactory;

    protected $primaryKey = 'support_ticket_reply_id';

    protected $fillable = [
        'support_ticket_id',
        'sender_user_id',
        'sender_type',
        'message',
        'email_sent_at',
    ];

    protected $casts = [
        'email_sent_at' => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(
            SupportTicket::class,
            'support_ticket_id',
            'support_ticket_id'
        );
    }

    public function sender()
    {
        return $this->belongsTo(
            User::class,
            'sender_user_id',
            'user_id'
        );
    }
}