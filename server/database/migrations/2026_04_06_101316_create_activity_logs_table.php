<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type'); // purchase | adjustment | manual_add | rule_change
            $table->uuid('player_id')->nullable();
            $table->foreign('player_id')->references('id')->on('players')->nullOnDelete();
            $table->string('player_nickname');
            $table->text('description');
            $table->string('source')->nullable(); // website | telegram
            $table->integer('amount')->nullable();
            $table->integer('delta')->nullable();
            $table->timestamp('logged_at')->useCurrent();

            $table->index('logged_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
