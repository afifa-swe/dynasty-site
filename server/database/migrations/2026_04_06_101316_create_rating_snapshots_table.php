<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rating_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('player_id');
            $table->foreign('player_id')->references('id')->on('players')->cascadeOnDelete();
            $table->integer('rating');
            $table->string('source')->nullable(); // website | telegram
            $table->integer('amount')->nullable();
            $table->timestamp('recorded_at')->useCurrent();

            $table->index('player_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rating_snapshots');
    }
};
