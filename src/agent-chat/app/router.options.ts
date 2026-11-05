import type { RouterConfig } from '@nuxt/schema';

export default <RouterConfig>{
    scrollBehavior(to, _from, savedPosition) {
        if (to.path.startsWith('/c/')) {
            return false;
        }
        return savedPosition ?? { top: 0 };
    },
};
