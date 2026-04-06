<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nickname');
            $table->string('phone')->nullable()->unique();
            $table->integer('rating')->default(0);
            $table->integer('rank')->default(0);
            $table->string('faction'); // darkness | light
            $table->string('tier')->default('treasure'); // legendary | noble | treasure
            $table->string('avatar')->nullable();
            $table->dateTime('join_date')->useCurrent();
            $table->integer('purchases_count')->default(0);
            $table->jsonb('achievements')->default('[]');
            $table->dateTime('last_purchase_at')->nullable();
            $table->dateTime('last_active')->nullable();
            $table->string('preferred_channel')->nullable(); // website | telegram
            $table->integer('total_volume')->default(0);
            // Иерархия дерева — ссылка на родителя (FK добавляется после создания таблицы)
            $table->uuid('parent_id')->nullable();
            $table->timestamps();

            $table->index('rating');
            $table->index('faction');
            $table->index('nickname');
        });

        // Self-referencing FK для parent_id
        Schema::table('players', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('players')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('players');
    }
};
