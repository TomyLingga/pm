<?php

namespace App\Providers;

use App\Models\PmTask;
use App\Models\DailyActivity;
use App\Models\PmTaskItem;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        //
    }

    public function boot()
    {
        // Short, stable aliases in polymorphic columns instead of class names.
        Relation::morphMap([
            'user' => User::class,
            WorkOrder::MORPH_ALIAS => WorkOrder::class,
            ServiceRequest::MORPH_ALIAS => ServiceRequest::class,
            PmTask::MORPH_ALIAS => PmTask::class,
            PmTaskItem::MORPH_ALIAS => PmTaskItem::class,
            WorkProgram::MORPH_ALIAS => WorkProgram::class,
            WorkProgramActivity::MORPH_ALIAS => WorkProgramActivity::class,
            DailyActivity::MORPH_ALIAS => DailyActivity::class,
        ]);

        Carbon::setLocale(config('app.locale'));
    }
}
