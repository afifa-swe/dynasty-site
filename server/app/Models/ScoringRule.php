<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScoringRule extends Model
{
    use HasFactory;

    protected $table = 'scoring_rules';

    protected $fillable = [
        'base_points_per_dollar',
        'website_bonus_percent',
        'telegram_bonus_percent',
        'high_value_threshold',
        'high_value_bonus_percent',
        'decay_per_day',
    ];
}
