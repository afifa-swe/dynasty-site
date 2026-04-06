<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scoring_rules', function (Blueprint $table) {
            $table->id();
            $table->integer('base_points_per_dollar')->default(2);
            $table->integer('website_bonus_percent')->default(5);
            $table->integer('telegram_bonus_percent')->default(8);
            $table->integer('high_value_threshold')->default(750);
            $table->integer('high_value_bonus_percent')->default(12);
            $table->integer('decay_per_day')->default(0);
            $table->timestamps();
        });

        // Вставляем singleton-запись с дефолтными правилами
        DB::table('scoring_rules')->insert([
            'id' => 1,
            'base_points_per_dollar' => 2,
            'website_bonus_percent' => 5,
            'telegram_bonus_percent' => 8,
            'high_value_threshold' => 750,
            'high_value_bonus_percent' => 12,
            'decay_per_day' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('scoring_rules');
    }
};
