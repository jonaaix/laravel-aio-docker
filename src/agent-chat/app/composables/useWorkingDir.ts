import type { InjectionKey, Ref } from 'vue';

export const workingDirKey: InjectionKey<Ref<string>> = Symbol('workingDir');

export function useWorkingDir(): Ref<string> {
    return inject(workingDirKey, ref(''));
}
