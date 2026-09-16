<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    use HasFactory;

    protected $primaryKey = 'support_ticket_id';

    protected $fillable = [
        'ticket_number',
        'user_id',
        'order_id',
        'name',
        'email',
        'category',
        'subject',
        'message',
        'status',
        'priority',
        'email_sent_at',
        'resolved_at',
    ];

    protected $casts = [
        'email_sent_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function replies()
    {
        return $this->hasMany(
            SupportTicketReply::class,
            'support_ticket_id',
            'support_ticket_id'
        )
        ->orderBy('created_at')
        ->orderBy('support_ticket_reply_id');
    }
}