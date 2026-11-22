// The ratings feature's front door (quick ratings of teams and people, and the team pages): other parts of the app
// import only from here.
export { ratingsApi, type RatingsApi } from "./api";
export { canGiveRatings, canRatePerson, canRateTeam, canSeePersonRatings, canSeeTeam, canSeeTeamRatings, SCORE_WORDS } from "./rules";
export { AverageMark, RateButton } from "./components/rate-button";
export { RatingDialog, type RatingTarget } from "./components/rating-dialog";
export { RatingsPanel } from "./components/ratings-panel";
export { TeamsToRate } from "./components/teams-to-rate";
export { TeamPage } from "./pages/team-page";
export { TeamsPage } from "./pages/teams-page";
export type * from "./types";
