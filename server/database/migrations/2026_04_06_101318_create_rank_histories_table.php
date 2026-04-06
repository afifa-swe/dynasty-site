<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rank_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('player_id');
            $table->foreign('player_id')->references('id')->on('players')->cascadeOnDelete();
            $table->integer('from_rank');
            $table->integer('to_rank');
            $table->integer('rating');
            $table->timestamp('changed_at')->useCurrent();

            $table->index('player_id');
            $table->index('changed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rank_histories');
    }
};
