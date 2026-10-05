<?php

namespace App\Http\Requests\WorkOrders;

/** Shared validation rules for material and labour rows. */
trait WorkOrderItemRules
{
    protected function materialRules(string $prefix = 'materials'): array
    {
        return [
            "{$prefix}.*.material_id" => ['nullable', 'integer', 'exists:materials,id'],
            "{$prefix}.*.material_name" => ["required_without:{$prefix}.*.material_id", 'nullable', 'string', 'max:150'],
            "{$prefix}.*.quantity" => ['required', 'numeric', 'gt:0', 'max:999999'],
            "{$prefix}.*.unit" => ["required_without:{$prefix}.*.material_id", 'nullable', 'string', 'max:20'],
        ];
    }

    protected function labourRules(string $prefix = 'labours'): array
    {
        return [
            "{$prefix}.*.user_id" => ['nullable', 'integer', 'exists:users,id'],
            "{$prefix}.*.worker_name" => ["required_without:{$prefix}.*.user_id", 'nullable', 'string', 'max:150'],
            "{$prefix}.*.started_at" => ['required', 'date'],
            "{$prefix}.*.finished_at" => ['required', 'date'],
        ];
    }

    protected function clearanceRules(string $requiredRule = 'required'): array
    {
        return [
            'clearance' => [$requiredRule, 'array', 'size:2'],
            'clearance.*.item_no' => ['required', 'integer', 'in:1,2', 'distinct'],
            'clearance.*.result' => ['required', 'in:ok,not_ok'],
        ];
    }
}
