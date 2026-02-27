# Agentation Pilot Policy And Checklist

Date: February 27, 2026  
Status: Draft for approval  
Decision: Pilot approved, global default not approved yet

## 1) Policy Summary

We will run a controlled pilot of Agentation for frontend engineering workflows.  
We will not adopt it as a global default until legal, security, and operational criteria are met.

## 2) Pilot Scope

In scope:
- React web apps
- Development and staging environments
- UI feedback loops between humans and coding agents

Out of scope:
- Production default enablement
- Mobile/native apps
- Non-React projects
- Org-wide mandatory rollout

## 3) Mandatory Guardrails

Licensing and legal:
- Complete legal review of PolyForm Shield 1.0.0 usage before expanding beyond pilot teams.
- Do not position Agentation as an internal standard until legal explicitly approves.

Security and data:
- Treat annotations as potentially sensitive engineering data.
- Do not include secrets, credentials, customer PII, or regulated data in annotations.
- Default to dev/staging data only.

Runtime and network hardening:
- Prefer `--mcp-only` when browser-to-server sync is not required.
- If HTTP mode is required, run in local dev only and restrict access to local machine/network controls.
- Keep `AGENTATION_API_KEY` in approved secret management only.
- Disable webhooks unless explicitly required; if required, use endpoint allowlisting.

Operational controls:
- Pin versions (`agentation`, `agentation-mcp`) during pilot.
- Review upstream changelog weekly during pilot.
- Track incidents and regressions in the team issue tracker.

## 4) Ownership

- Pilot sponsor: Engineering Manager (Web Platform)
- Technical owner: Frontend lead
- Security reviewer: AppSec representative
- Legal reviewer: Product/OSS counsel
- Pilot teams: 2 to 3 frontend teams

## 5) Success Metrics

- Median annotation-to-merged-fix time improves by at least 20%.
- At least 70% of pilot participants report faster UI issue triage.
- No Sev1/Sev2 security incidents attributable to pilot tooling.
- No legal blockers remain unresolved by pilot end.
- Operational overhead remains acceptable (no persistent break/fix burden).

## 6) Exit Criteria For Global Rollout

All must be true:
- Legal approval recorded for intended company usage pattern.
- Security sign-off recorded with hardening guidance.
- Stable internal setup guide published and validated by at least 2 teams.
- Pilot success metrics met.
- Named owner assigned for ongoing maintenance and version governance.

If any criterion fails, extend pilot or hold adoption.

## 7) 30-Day Pilot Checklist

Week 0 (preflight):
- [ ] Legal review completed and documented.
- [ ] Security review completed and documented.
- [ ] Internal setup guide created (install, hardening, troubleshooting).
- [ ] Package versions pinned in pilot repos.
- [ ] Data-handling guidance shared with pilot teams.

Week 1 to 2 (initial rollout):
- [ ] Enable for first pilot team in dev/staging.
- [ ] Capture baseline metrics (before and after).
- [ ] Run weekly check-in (adoption, friction, incidents).
- [ ] Validate fallback workflow when Agentation is unavailable.

Week 3 to 4 (expand and evaluate):
- [ ] Expand to second and third pilot teams.
- [ ] Reconfirm security controls and webhook usage.
- [ ] Compile incident log and mitigation actions.
- [ ] Gather participant feedback survey.

Day 30 (decision gate):
- [ ] Publish pilot report with metrics and recommendation.
- [ ] Decide: global rollout, extended pilot, or no-go.
- [ ] If rollout approved, publish phased rollout plan and owner model.

## 8) Recommended Default Config During Pilot

Use local-only workflows first:

```bash
npx add-mcp "npx -y agentation-mcp server --mcp-only"
```

If browser sync is required for a team:

```bash
npx -y agentation-mcp server --port 4747
```

Cloud mode should be opt-in only, with explicit security review.

## 9) Evidence Basis (as of February 27, 2026)

- Agentation FAQ states it is designed as a development tool and recommends feature-flagged usage.
- Agentation MCP docs document local server behavior, tools, and options.
- Project uses PolyForm Shield 1.0.0 license.
- Public `/pricing` and `/security` routes were not available at review time (404).
