import { getTranslations } from "next-intl/server";

import { toListSearch, type ListParams } from "@/lib/list/params";

import { getJobCounts, getOpenJobCount, listJobs } from "../queries";
import { JobsListView } from "./jobs-list";

export async function JobsSummary() {
  const [t, counts] = await Promise.all([getTranslations("jobs"), getJobCounts()]);
  if (!counts.ok) return null;
  return <p>{t("summary", { total: counts.total, archived: counts.archived })}</p>;
}

// The search never reaches the server in the URL (docs/architecture.md, "Never
// in URLs"): the first render has none and the first search runs on the client.
export async function JobsList({ params }: { params: ListParams }) {
  const listParams = { ...params, search: "" };
  const [page, counts] = await Promise.all([listJobs(listParams), getJobCounts()]);
  return (
    <JobsListView
      initial={counts.ok ? page : { ok: false }}
      initialKey={toListSearch(listParams)}
      total={counts.ok ? counts.total : 0}
    />
  );
}

// Inicio's table: the open jobs, and the recently closed ones once asked for. The same first render
// as JobsList, with the home scope; its total is the open jobs, for the empty state.
export async function HomeJobsList({ params }: { params: ListParams }) {
  const listParams = { ...params, search: "" };
  const [page, open] = await Promise.all([listJobs(listParams, "home"), getOpenJobCount()]);
  return (
    <JobsListView
      initial={open.ok ? page : { ok: false }}
      initialKey={toListSearch(listParams)}
      total={open.ok ? open.total : 0}
      scope="home"
    />
  );
}
