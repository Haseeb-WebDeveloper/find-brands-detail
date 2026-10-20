/**
 * A line in a brand's research log, written as the research runs and shown live in the app. Plain
 * language for the person watching ("Checking tirtir.co.kr…"), never internals.
 */
export type LogLevel = "info" | "good" | "warn";
export type ResearchLog = (message: string, level?: LogLevel) => Promise<void> | void;

export const noLog: ResearchLog = () => {};
