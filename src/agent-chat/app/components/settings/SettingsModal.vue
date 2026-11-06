<script setup lang="ts">
import type { SettingsCategory } from '~/composables/useSettingsWindow';

const props = withDefaults(defineProps<{ category?: SettingsCategory }>(), { category: 'appearance' });
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ 'after:leave': []; 'close': [] }>();
const { t } = useI18n();

const { public: { hub } } = useRuntimeConfig();
const { user } = useUserName();

const categories = computed<{ value: SettingsCategory; label: string; icon: string }[]>(() => [
    { value: 'appearance', label: 'Appearance', icon: 'i-heroicons-swatch' },
    { value: 'chat', label: 'Chat', icon: 'i-heroicons-chat-bubble-left-right' },
    { value: 'speech', label: 'Read aloud', icon: 'i-heroicons-speaker-wave' },
    { value: 'agents', label: 'Agents', icon: 'i-heroicons-cpu-chip' },
    { value: 'profile', label: 'Profile', icon: 'i-heroicons-user' },
    { value: 'account', label: 'Claude account', icon: 'i-heroicons-key' },
    ...(user.value?.admin ? [{ value: 'admin' as const, label: 'Admin', icon: 'i-heroicons-shield-check' }] : []),
    hub
        ? { value: 'notifications', label: 'Notifications', icon: 'i-heroicons-bell' }
        : { value: 'remote', label: 'Remote control', icon: 'i-heroicons-device-phone-mobile' },
]);

const settingsWindow = useSettingsWindow();
const route = useRoute();
const active = ref<SettingsCategory>(props.category);

watch(active, category => settingsWindow.show(category));
watch(() => route.query.settings, (value) => {
    if (isSettingsCategory(value)) {
        active.value = value;
    }
});
watch(open, (isOpen) => {
    if (!isOpen) {
        settingsWindow.close();
    }
});

watch(() => user.value?.admin, (admin) => {
    if (!admin && active.value === 'admin') {
        active.value = 'profile';
    }
});
const hasActions = computed(() => active.value === 'agents');
</script>

<template>
    <UModal
        v-model:open="open"
        :title="t('Settings')"
        :ui="{ content: 'sm:max-w-6xl', body: 'p-0 sm:p-0', footer: 'justify-between' }"
        @after:leave="emit('after:leave')"
    >
        <template #body>
            <div class="flex flex-col sm:min-h-[34rem] sm:flex-row">
                <nav class="flex shrink-0 gap-1 overflow-x-auto border-b border-default p-3 sm:w-52 sm:flex-col sm:border-e sm:border-b-0">
                    <button
                        v-for="category in categories"
                        :key="category.value"
                        type="button"
                        class="flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-500 ease-out hover:bg-primary/10"
                        :class="active === category.value ? 'bg-primary/12 font-medium text-primary' : 'text-toned'"
                        @click="active = category.value"
                    >
                        <UIcon :name="category.icon" class="size-5 shrink-0" />
                        {{ t(category.label) }}
                    </button>
                </nav>
                <div class="min-w-0 flex-1 p-4 pb-8 sm:p-5 sm:pb-10">
                    <SettingsAppearance v-if="active === 'appearance'" />
                    <SettingsChat v-else-if="active === 'chat'" />
                    <SettingsReadAloud v-else-if="active === 'speech'" />
                    <SettingsAgents v-else-if="active === 'agents'" actions-target="#settings-actions" />
                    <SettingsProfile v-else-if="active === 'profile'" @unlocked="active = 'admin'" />
                    <SettingsAccount v-else-if="active === 'account'" />
                    <SettingsAdmin v-else-if="active === 'admin'" />
                    <SettingsNotifications v-else-if="active === 'notifications'" />
                    <SettingsRemoteControl v-else />
                </div>
            </div>
        </template>
        <template v-if="hasActions" #footer>
            <div id="settings-actions" class="flex w-full items-center justify-between gap-2" />
        </template>
    </UModal>
</template>
