<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IngestEvent extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'ingest_events';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'source',
        'status',
        'order_id',
        'nickname',
        'phone',
        'amount',
        'items',
        'raw_payload',
        'error_message',
        'player_id',
    ];

    protected $casts = [
        'items' => 'array',
        'raw_payload' => 'array',
    ];

    /**
     * Игрок, связанный с событием загрузки.
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'player_id');
    }
}
