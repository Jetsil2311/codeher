// Generated dispatcher: each call goes to the local JSON store or to Supabase (DATA_MODE).
import "server-only";
import { pick } from "./pick";
import * as L from "./local/student";
import * as R from "./sb/student";

export { AVATARS, type SignInResult } from "./local/student";
export { signOut as sbSignOut, me as sbMe, type StudentSession } from "./sb/student";

export const signIn = pick(L.signIn, R.signIn);
export const home = pick(L.home, R.home);
export const path = pick(L.path, R.path);
export const lesson = pick(L.lesson, R.lesson);
export const submitCode = pick(L.submitCode, R.submitCode);
export const submitAnswer = pick(L.submitAnswer, R.submitAnswer);
export const completeLesson = pick(L.completeLesson, R.completeLesson);
export const listProjects = pick(L.listProjects, R.listProjects);
export const getProject = pick(L.getProject, R.getProject);
export const createProject = pick(L.createProject, R.createProject);
export const saveProject = pick(L.saveProject, R.saveProject);
export const renameProject = pick(L.renameProject, R.renameProject);
export const duplicateProject = pick(L.duplicateProject, R.duplicateProject);
export const deleteProject = pick(L.deleteProject, R.deleteProject);
export const projectVersion = pick(L.projectVersion, R.projectVersion);
export const nominateProject = pick(L.nominateProject, R.nominateProject);
export const updateProfile = pick(L.updateProfile, R.updateProfile);
export const changePin = pick(L.changePin, R.changePin);
export const recreo = pick(L.recreo, R.recreo);
export const recreoStart = pick(L.recreoStart, R.recreoStart);
export const recreoScore = pick(L.recreoScore, R.recreoScore);
export { RECREO } from "./local/student";
