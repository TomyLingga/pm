<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offices are Portal "Penempatan Area" (`GET /api/sso/placements`), synced by `portal:sync`.
 * Portal allows codes up to 50 and names up to 150 characters.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->uuid('portal_area_id')->nullable()->unique()->after('id');
            $table->timestamp('synced_at')->nullable()->after('is_active');
        });
        // No doctrine/dbal for ->change(); the app runs on PostgreSQL only.
        DB::statement('ALTER TABLE offices ALTER COLUMN code TYPE varchar(50)');
        DB::statement('ALTER TABLE offices ALTER COLUMN name TYPE varchar(150)');
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropUnique(['portal_area_id']);
            $table->dropColumn(['portal_area_id', 'synced_at']);
        });
        DB::statement('ALTER TABLE offices ALTER COLUMN code TYPE varchar(20)');
        DB::statement('ALTER TABLE offices ALTER COLUMN name TYPE varchar(100)');
    }
};
