<?php

namespace App\Providers;

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
        ]);

        Carbon::setLocale(config('app.locale'));
    }
}
