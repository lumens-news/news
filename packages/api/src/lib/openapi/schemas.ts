import { beatEnum as beat, approvedSignalSchema as signal } from "@lumens-news/types";

export const beatSchema = beat.openapi("Beat");
export const signalSchema = signal.openapi("Signal");
