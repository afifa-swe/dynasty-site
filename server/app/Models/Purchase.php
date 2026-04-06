<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Purchase extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'purchases';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'player_id',
        'amount',
        'order_id',
        'source',
        'items',
        'faction_preference',
        'rating_delta',
    ];

    protected $casts = [
        'items' => 'array',
    ];

    /**
     * Игрок, совершивший покупку.
     */
    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'player_id');
    }
}
