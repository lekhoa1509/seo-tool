<?php
/**
 * Plugin Name: TGG Product Instruction Tabs
 * Description: Shows WooCommerce product tabs from SEO Tool product meta.
 * Version: 1.1.0
 * Author: TGG
 */

if (!defined('ABSPATH')) {
    exit;
}

const TGG_USAGE_META_KEY = '_tgg_usage_instructions';
const TGG_STORAGE_META_KEY = '_tgg_storage_instructions';
const TGG_CUSTOM_TABS_META_KEY = '_tgg_custom_product_tabs';

function tgg_product_tab_meta_keys() {
    return [TGG_USAGE_META_KEY, TGG_STORAGE_META_KEY, TGG_CUSTOM_TABS_META_KEY];
}

function tgg_current_product_id() {
    global $product;

    if (is_a($product, 'WC_Product')) {
        return $product->get_id();
    }

    $post_id = get_the_ID();
    return 'product' === get_post_type($post_id) ? $post_id : 0;
}

function tgg_register_product_tab_meta() {
    $args = [
        'single' => true,
        'type' => 'string',
        'show_in_rest' => true,
        'sanitize_callback' => 'wp_kses_post',
        'auth_callback' => function () {
            return current_user_can('edit_products') || current_user_can('manage_woocommerce');
        },
    ];

    register_post_meta('product', TGG_USAGE_META_KEY, $args);
    register_post_meta('product', TGG_STORAGE_META_KEY, $args);
    register_post_meta('product', TGG_CUSTOM_TABS_META_KEY, $args);
}

add_action('init', 'tgg_register_product_tab_meta');

function tgg_product_tab_content($meta_key, $product_id = 0) {
    $product_id = $product_id ? absint($product_id) : tgg_current_product_id();

    if (!$product_id) {
        return '';
    }

    return get_post_meta($product_id, $meta_key, true);
}

function tgg_product_tab_title_slug($title) {
    return sanitize_title(remove_accents($title));
}

function tgg_parse_custom_product_tabs($raw_tabs) {
    $decoded = json_decode((string) $raw_tabs, true);

    if (!is_array($decoded)) {
        return [];
    }

    $tabs = [];

    foreach ($decoded as $index => $tab) {
        if (!is_array($tab)) {
            continue;
        }

        $title = isset($tab['title']) ? trim(wp_strip_all_tags($tab['title'])) : '';
        $content = isset($tab['content']) ? trim((string) $tab['content']) : '';

        if ('' === $title || '' === $content) {
            continue;
        }

        $slug = tgg_product_tab_title_slug($title);
        $tabs[] = [
            'title' => $title,
            'content' => $content,
            'priority' => isset($tab['priority']) ? absint($tab['priority']) : 34 + absint($index),
            'class' => 'tgg-custom-tab-' . sanitize_html_class($slug ? $slug : 'tab-' . absint($index + 1)),
            'key' => 'tgg_custom_' . sanitize_key($slug ? $slug : 'tab_' . absint($index + 1)) . '_' . absint($index),
        ];
    }

    return $tabs;
}

function tgg_product_custom_tabs($product_id = 0) {
    return tgg_parse_custom_product_tabs(tgg_product_tab_content(TGG_CUSTOM_TABS_META_KEY, $product_id));
}

function tgg_custom_tabs_include_title($custom_tabs, $needles) {
    foreach ($custom_tabs as $tab) {
        $slug = tgg_product_tab_title_slug($tab['title']);

        foreach ($needles as $needle) {
            if (false !== strpos($slug, $needle)) {
                return true;
            }
        }
    }

    return false;
}

function tgg_mark_product_instruction_tabs_rendered() {
    $GLOBALS['tgg_product_instruction_tabs_rendered'] = true;
}

function tgg_render_product_instruction_tab_content($content, $class_name) {
    tgg_mark_product_instruction_tabs_rendered();

    echo '<div class="tgg-product-tab ' . esc_attr($class_name) . '">';
    echo wp_kses_post($content);
    echo '</div>';
}

function tgg_render_product_instruction_section($title, $content, $class_name) {
    if (empty($content)) {
        return;
    }

    echo '<div class="product-section tgg-product-instruction-section ' . esc_attr($class_name) . '">';
    echo '<div class="row">';
    echo '<div class="large-2 col pb-0 mb-0">';
    echo '<h5 class="uppercase mt">' . esc_html($title) . '</h5>';
    echo '</div>';
    echo '<div class="large-10 col pb-0 mb-0">';
    echo '<div class="panel entry-content tgg-product-tab ' . esc_attr($class_name) . '">';
    echo wp_kses_post($content);
    echo '</div>';
    echo '</div>';
    echo '</div>';
    echo '</div>';
}

function tgg_render_product_instruction_sections_fallback() {
    if (!empty($GLOBALS['tgg_product_instruction_tabs_rendered'])) {
        return;
    }

    $custom_tabs = tgg_product_custom_tabs();
    $usage_content = tgg_product_tab_content(TGG_USAGE_META_KEY);
    $storage_content = tgg_product_tab_content(TGG_STORAGE_META_KEY);
    $has_usage_custom_tab = tgg_custom_tabs_include_title($custom_tabs, ['huong-dan-su-dung', 'cach-su-dung']);
    $has_storage_custom_tab = tgg_custom_tabs_include_title($custom_tabs, ['huong-dan-bao-quan', 'bao-quan']);

    if (empty($custom_tabs) && empty($usage_content) && empty($storage_content)) {
        return;
    }

    echo '<div class="product-page-sections tgg-product-instruction-sections">';

    foreach ($custom_tabs as $tab) {
        tgg_render_product_instruction_section($tab['title'], $tab['content'], $tab['class']);
    }

    if (!$has_usage_custom_tab) {
        tgg_render_product_instruction_section(__('Hướng dẫn sử dụng', 'tgg-product-tabs'), $usage_content, 'tgg-usage-instructions');
    }

    if (!$has_storage_custom_tab) {
        tgg_render_product_instruction_section(__('Hướng dẫn bảo quản', 'tgg-product-tabs'), $storage_content, 'tgg-storage-instructions');
    }

    echo '</div>';

    tgg_mark_product_instruction_tabs_rendered();
}

function tgg_product_tabs_meta_box($post) {
    $usage_content = get_post_meta($post->ID, TGG_USAGE_META_KEY, true);
    $storage_content = get_post_meta($post->ID, TGG_STORAGE_META_KEY, true);
    $custom_tabs = tgg_product_custom_tabs($post->ID);

    wp_nonce_field('tgg_product_tabs_save', 'tgg_product_tabs_nonce');
    ?>
    <p>
        <label for="tgg_usage_instructions"><strong><?php esc_html_e('Hướng dẫn sử dụng', 'tgg-product-tabs'); ?></strong></label>
        <textarea id="tgg_usage_instructions" name="tgg_usage_instructions" rows="8" style="width:100%;margin-top:6px;"><?php echo esc_textarea($usage_content); ?></textarea>
    </p>
    <p>
        <label for="tgg_storage_instructions"><strong><?php esc_html_e('Hướng dẫn bảo quản', 'tgg-product-tabs'); ?></strong></label>
        <textarea id="tgg_storage_instructions" name="tgg_storage_instructions" rows="8" style="width:100%;margin-top:6px;"><?php echo esc_textarea($storage_content); ?></textarea>
    </p>
    <p style="color:#646970;margin-bottom:0;">
        <?php esc_html_e('Hai trường này được SEO Tool cập nhật qua WooCommerce API và được render thành tab ngoài trang sản phẩm.', 'tgg-product-tabs'); ?>
    </p>
    <?php if (!empty($custom_tabs)) : ?>
        <hr />
        <p><strong><?php esc_html_e('Tab tùy chỉnh từ SEO Tool', 'tgg-product-tabs'); ?></strong></p>
        <ul style="list-style:disc;margin-left:18px;">
            <?php foreach ($custom_tabs as $tab) : ?>
                <li><?php echo esc_html($tab['title']); ?></li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>
    <?php
}

add_action('add_meta_boxes', function () {
    add_meta_box(
        'tgg_product_instruction_tabs',
        __('TGG Product Instruction Tabs', 'tgg-product-tabs'),
        'tgg_product_tabs_meta_box',
        'product',
        'normal',
        'default'
    );
});

add_action('save_post_product', function ($post_id) {
    if (!isset($_POST['tgg_product_tabs_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tgg_product_tabs_nonce'])), 'tgg_product_tabs_save')) {
        return;
    }

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    $usage_content = isset($_POST['tgg_usage_instructions'])
        ? wp_kses_post(wp_unslash($_POST['tgg_usage_instructions']))
        : '';
    $storage_content = isset($_POST['tgg_storage_instructions'])
        ? wp_kses_post(wp_unslash($_POST['tgg_storage_instructions']))
        : '';

    update_post_meta($post_id, TGG_USAGE_META_KEY, $usage_content);
    update_post_meta($post_id, TGG_STORAGE_META_KEY, $storage_content);
});

add_filter('woocommerce_product_tabs', function ($tabs) {
    $custom_tabs = tgg_product_custom_tabs();
    $usage_content = tgg_product_tab_content(TGG_USAGE_META_KEY);
    $storage_content = tgg_product_tab_content(TGG_STORAGE_META_KEY);
    $has_usage_custom_tab = tgg_custom_tabs_include_title($custom_tabs, ['huong-dan-su-dung', 'cach-su-dung']);
    $has_storage_custom_tab = tgg_custom_tabs_include_title($custom_tabs, ['huong-dan-bao-quan', 'bao-quan']);

    foreach ($custom_tabs as $custom_tab) {
        $tabs[$custom_tab['key']] = [
            'title' => $custom_tab['title'],
            'priority' => $custom_tab['priority'],
            'callback' => function () use ($custom_tab) {
                tgg_render_product_instruction_tab_content($custom_tab['content'], $custom_tab['class']);
            },
        ];
    }

    if (!empty($usage_content) && !$has_usage_custom_tab) {
        $tabs['tgg_usage_instructions'] = [
            'title' => __('Hướng dẫn sử dụng', 'tgg-product-tabs'),
            'priority' => 35,
            'callback' => function () use ($usage_content) {
                tgg_render_product_instruction_tab_content($usage_content, 'tgg-usage-instructions');
            },
        ];
    }

    if (!empty($storage_content) && !$has_storage_custom_tab) {
        $tabs['tgg_storage_instructions'] = [
            'title' => __('Hướng dẫn bảo quản', 'tgg-product-tabs'),
            'priority' => 36,
            'callback' => function () use ($storage_content) {
                tgg_render_product_instruction_tab_content($storage_content, 'tgg-storage-instructions');
            },
        ];
    }

    return $tabs;
});

add_action('woocommerce_after_single_product_summary', 'tgg_render_product_instruction_sections_fallback', 12);

function tgg_purge_product_instruction_tab_cache($meta_id, $object_id, $meta_key) {
    if (!in_array($meta_key, tgg_product_tab_meta_keys(), true)) {
        return;
    }

    if ('product' !== get_post_type($object_id)) {
        return;
    }

    clean_post_cache($object_id);

    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients($object_id);
    }

    if (has_action('litespeed_purge_post')) {
        do_action('litespeed_purge_post', $object_id);
    }

    if (has_action('litespeed_purge_url')) {
        do_action('litespeed_purge_url', get_permalink($object_id));
    }
}

add_action('added_post_meta', 'tgg_purge_product_instruction_tab_cache', 10, 3);
add_action('updated_post_meta', 'tgg_purge_product_instruction_tab_cache', 10, 3);
