import { Ref, shallowRef } from "vue";
import { IDbInitState } from "@kikko-land/vue-use";

export const currentDb = shallowRef<IDbInitState>({
  type: "notInitialized",
}) as Ref<IDbInitState>;
