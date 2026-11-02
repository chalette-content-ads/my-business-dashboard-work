# Publishing the template (instructor record)

Template repository: **https://github.com/ivaninm-ai/business-dashboard-starter** (public, marked as a template).
Offline classroom file: attached to the latest release (`v0.7.0`: the AI analysis marks its top three tasks and the dates to watch in Tasks and the Calendar; `v0.6.0` new look and calendar, a changed layout starts from the earlier matching; `v0.5.0` match your columns — Excel in other layouts; `v0.4.0` no built-in data; `v0.3.0` added Gemini analysis and site settings; `v0.2.0` added My Excel) — https://github.com/ivaninm-ai/business-dashboard-starter/releases/latest

## Decisions (2026-09-24)

- Public repository `ivaninm-ai/business-dashboard-starter`, separate from `analysis-dashboard-template`.
- **MIT licence**, copyright Infinite New Media (added 2026-09-24, after v0.2.0). Students and anyone
  else may use, change and sell their copies, or have someone extend them, as long as they keep the
  notice; the software is provided without warranty. The build puts the notice at the top of
  `dist/business-dashboard-demo.html`. The original Google Sheets template is not affected.
- Template only: no GitHub Pages site for the class copy. Each student can publish their own copy
  with the **Publish site** workflow (manual, no secrets).

## Releasing an update

1. Change the code, then `npm run check` (build + tests) and open `dist/business-dashboard-demo.html`.
2. Bump `version` in `package.json` and `src/version.js`, commit, push. The **Tests** workflow runs.
3. Tag (`git tag v0.2.1 && git push origin v0.2.1`, or type the new tag in GitHub's release form), create a release and
   attach the new `dist/business-dashboard-demo.html`. `dist/` is never committed.
4. Students who already made their copy do not get updates automatically (a template copy has no
   link back); they can copy changed files by hand if they want them.

## Keep separate

- This starter is independent of `business-dashboard/` (the Google Sheets template). Do not push it
  to `ivaninm-ai/analysis-dashboard-template`, and do not redirect that project's guides or Artifact here.
- Students' copies are theirs: they publish under their own accounts; nothing is hosted or paid for by
  the course.
