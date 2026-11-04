// Generated dispatcher: each call goes to the local JSON store or to Supabase (DATA_MODE).
import "server-only";
import { pick } from "./pick";
import * as L from "./local/public";
import * as R from "./sb/public";

export type { LogroCard } from "./local/public";

export const landing = pick(L.landing, R.landing);
export const logros = pick(L.logros, R.logros);
export const logro = pick(L.logro, R.logro);
export const publicLessons = pick(L.publicLessons, R.publicLessons);
export const publicLesson = pick(L.publicLesson, R.publicLesson);
export const checkPublicAnswer = pick(L.checkPublicAnswer, R.checkPublicAnswer);
export const errorCatalog = pick(L.errorCatalog, R.errorCatalog);
export const consentText = pick(L.consentText, R.consentText);
export const activeCommunities = pick(L.activeCommunities, R.activeCommunities);
