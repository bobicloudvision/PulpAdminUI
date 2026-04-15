import { cookies } from "next/headers";
import { getPulpApiUrl, PULP_AUTH_COOKIE, toBasicAuthHeader } from "@/lib/pulp";
import { requirePulpAuth } from "@/app/api/pulp/_helpers";
import {
  authHeaders,
  normalizePulpHrefToApiPath,
  readDetail,
  resolvePublicationHrefAfterTask,
  TaskRefResponse,
  toPulpHrefPath,
  waitForTask,
} from "../../_server";

type PublishBody = {
  pulp_href?: string;
};

export async function POST(request: Request) {
  const authResult = await requirePulpAuth();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = (await request.json()) as PublishBody;
  const repoHref = body.pulp_href?.trim();
  if (!repoHref) {
    return Response.json({ detail: "Repository pulp_href is required." }, { status: 400 });
  }

  const authHeader = toBasicAuthHeader(authResult.auth);
  const headers = authHeaders(authHeader);
  headers.set("Content-Type", "application/json");

  const repository = toPulpHrefPath(repoHref);

  const publishResponse = await fetch(getPulpApiUrl("/publications/file/file/"), {
    method: "POST",
    headers,
    body: JSON.stringify({ repository }),
    cache: "no-store",
  });

  if (!publishResponse.ok) {
    if (publishResponse.status === 401 || publishResponse.status === 403) {
      const cookieStore = await cookies();
      cookieStore.delete(PULP_AUTH_COOKIE);
    }
    return Response.json({ detail: await readDetail(publishResponse) }, { status: publishResponse.status });
  }

  const published = (await publishResponse.json()) as TaskRefResponse;
  let publicationHref = published.pulp_href ?? published.href ?? null;

  try {
    if (published.task) {
      const task = await waitForTask(published.task, authHeader);
      publicationHref = resolvePublicationHrefAfterTask(task, publicationHref);
    }
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "Publication task failed." },
      { status: 500 }
    );
  }

  return Response.json({
    publication: publicationHref,
    repository: normalizePulpHrefToApiPath(repoHref),
    task: published.task ?? null,
  });
}
