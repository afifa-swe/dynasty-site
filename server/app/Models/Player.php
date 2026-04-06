<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Player extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'players';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'nickname',
        'phone',
        'rating',
        'rank',
        'faction',
        'tier',
        'avatar',
        'join_date',
        'purchases_count',
        'achievements',
        'last_purchase_at',
        'last_active',
        'preferred_channel',
        'total_volume',
        'parent_id',
    ];

    protected $casts = [
        'achievements' => 'array',
        'join_date' => 'datetime',
        'last_purchase_at' => 'datetime',
        'last_active' => 'datetime',
    ];

    /**
     * Реферер (родительский игрок).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'parent_id');
    }

    /**
     * Рефералы (дочерние игроки).
     */
    public function children(): HasMany
    {
        return $this->hasMany(Player::class, 'parent_id');
    }

    /**
     * Покупки игрока.
     */
    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class, 'player_id');
    }

    /**
     * Снимки рейтинга.
     */
    public function ratingSnapshots(): HasMany
    {
        return $this->hasMany(RatingSnapshot::class, 'player_id');
    }

    /**
     * Логи активности.
     */
    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'player_id');
    }

    /**
     * События загрузки.
     */
    public function ingestEvents(): HasMany
    {
        return $this->hasMany(IngestEvent::class, 'player_id');
    }

    /**
     * История изменений ранга.
     */
    public function rankHistories(): HasMany
    {
        return $this->hasMany(RankHistory::class, 'player_id');
    }
}
