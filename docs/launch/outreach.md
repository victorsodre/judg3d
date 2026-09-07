# First-user outreach drafts

These are drafts for the maintainer to review and send. Personalize the first
sentence to the recipient's work. Do not imply an existing relationship,
partnership, customer or endorsement.

## Individual invitation

Hi [name] — I'm building judg3d, a local acceptance checker for glTF/GLB assets.
It combines Khronos format validation with configurable budgets and returns
actionable reports through a CLI, browser UI or MCP server.

Would you be willing to spend 15–20 minutes trying one of your own nonconfidential
assets this week? I'm looking for feedback on installation, report clarity and
whether the result helps you make an actual pipeline decision.

It is early-stage, MIT-licensed and runs locally. It currently checks format and
configured budgets; it does not judge visual quality or repair models.

Repository: https://github.com/victorsodre/judg3d

If you are interested, I can send the short tester guide. No commitment beyond
the trial, and please feel free to decline.

## X launch post

I built judg3d to give glTF/GLB pipelines a repeatable acceptance check.

This demo catches a triangle-budget failure, then checks the corrected export
against the same profile.

Local CLI, browser UI and MCP. MIT. Looking for 3D developers to try one asset
and tell me where the workflow falls short.

Attach the demonstration and add the repository link in a reply. Review the
platform's current length limit before posting; do not claim predicted reach.

## YouTube description

This is judg3d: a local acceptance checker for glTF/GLB assets. The demonstration
shows a box with redundant subdivisions, a triangle-budget rejection and a
corrected export that passes the same profile.

judg3d checks the exports; the authoring script performs the correction.
Current coverage is SCHEMA and PROFILE. Visual, geometry and semantic judging
are not implemented.

Source and reproduction instructions: https://github.com/victorsodre/judg3d

If you work with GLB/glTF, try a nonconfidential asset and share what worked,
what was confusing and whether the report helped you make a decision.

## Feedback follow-up

Thanks for trying judg3d. What was the first point where you got stuck or had
to guess? Did any result change what you did with the asset? If you can share a
minimal reproduction, I will try to reproduce the issue before proposing a fix.

Keep any follow-up proportionate to the recipient's response. Obtain permission
before attributing their feedback publicly.
