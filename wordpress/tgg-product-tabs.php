<?php
/**
 * Plugin Name: TGG Product Instruction Tabs
 * Description: Shows WooCommerce product tabs from SEO Tool product meta.
 * Version: 1.0.0
 * Author: TGG
 */

if (!defined('ABSPATH')) {
    exit;
}

const TGG_USAGE_META_KEY = '_tgg_usage_instructions';
const TGG_STORAGE_META_KEY = '_tgg_storage_instructions';

function tgg_product_tab_content($meta_key) {
    global $product;

    if (!$product) {
        return '';
    }

    return get_post_meta($product->get_id(), $meta_key, true);
}

add_filter('woocommerce_product_tabs', function ($tabs) {
    $usage_content = tgg_product_tab_content(TGG_USAGE_META_KEY);
    $storage_content = tgg_product_tab_content(TGG_STORAGE_META_KEY);

    if (!empty($usage_content)) {
        $tabs['tgg_usage_instructions'] = [
            'title' => __('Hướng dẫn sử dụng', 'tgg-product-tabs'),
            'priority' => 35,
            'callback' => function () use ($usage_content) {
                echo '<div class="tgg-product-tab tgg-usage-instructions">';
                echo wp_kses_post($usage_content);
                echo '</div>';
            },
        ];
    }

    if (!empty($storage_content)) {
        $tabs['tgg_storage_instructions'] = [
            'title' => __('Hướng dẫn bảo quản', 'tgg-product-tabs'),
            'priority' => 36,
            'callback' => function () use ($storage_content) {
                echo '<div class="tgg-product-tab tgg-storage-instructions">';
                echo wp_kses_post($storage_content);
                echo '</div>';
            },
        ];
    }

    return $tabs;
});
