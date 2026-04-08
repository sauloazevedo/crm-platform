# Smart CRM

Smart CRM is a workspace for a CRM tailored to the tax preparer universe. The codebase is currently organized into distinct projects with different delivery paths:

- `crm-platform`: active frontend project, deployed through GitHub and AWS Amplify.
- `crm-IaC`: active infrastructure and backend project, deployed through GitHub and AWS CodePipeline.
- `smart-app`: parked project for the future mobile app. This folder remains in the repository, but it is intentionally out of the active workspace flow for now.

## Active project split

### `crm-platform`

- purpose: frontend for the CRM
- stack: Next.js
- deployment flow: GitHub -> AWS Amplify
- current status: active development

### `crm-IaC`

- purpose: backend, infrastructure as code, and platform automation
- stack: TypeScript + AWS CDK
- deployment flow: GitHub -> AWS CodePipeline
- current status: active development

### `smart-app`

- purpose: future mobile application
- current status: on hold
- workspace status: excluded from active root scripts and active workspace automation

## Product direction

This CRM is being designed for tax offices and independent tax preparers who need more than a generic pipeline tool. The platform should support:

- lead intake and qualification for new tax clients
- onboarding with document checklist and reminders
- tax season workflow visibility
- CRM segmentation by filing status, entity type, language, and tax year
- engagement tracking for returning clients
- compliance-friendly communication history
- task management for preparers, reviewers, and admin staff
- payment and service status visibility

## Suggested architecture

- TypeScript across the stack for shared contracts and faster iteration
- API-first backend with strong domain modeling
- role-based access for preparers, admins, reviewers, and clients
- shared design language between web platform and mobile app
- infrastructure as code from day one to keep environments reproducible

## Current roadmap

1. Continue building the frontend in `crm-platform`.
2. Build out backend and infrastructure in `crm-IaC`.
3. Keep `smart-app` isolated until the web and backend foundations are stable.

## Root scripts

- `npm run dev:platform`
- `npm run dev:backend`
- `npm run build:platform`
- `npm run build:backend`
- `npm run lint:platform`
- `npm run lint:backend`

The root workspace intentionally does not build or run `smart-app` yet.
