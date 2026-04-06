<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingest_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('source'); // website | telegram
            $table->string('status'); // success | error
            $table->string('order_id')->nullable();
            $table->string('nickname')->nullable();
            $table->string('phone')->nullable();
            $table->integer('amount')->nullable();
            $table->jsonb('items')->default('[]');
            $table->jsonb('raw_payload');
            $table->text('error_message')->nullable();
            $table->uuid('player_id')->nullable();
            $table->foreign('player_id')->references('id')->on('players')->nullOnDelete();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingest_events');
    }
};
