import { beforeEach, describe, expect, it } from "vitest";
import { resetMockStore } from "./store";
import { MockAssignmentRepository } from "./assignment-repository";
import { MockEvaluationRepository } from "./evaluation-repository";
import { MockResultsRepository } from "./results-repository";
import { MockAuthRepository } from "./auth-repository";
import { MockClientRepository } from "./client-repository";
import { MockJudgeRepository } from "./judge-repository";
import { MockHackathonRepository } from "./hackathon-repository";
import { MockApplicationFormRepository } from "./application-form-repository";
import { MockApplicationFormQuestionRepository } from "./application-form-question-repository";
import { MockPublishedCompetitionRepository } from "./published-competition-repository";
import { MockPublicApplicationRepository } from "./public-application-repository";
import { MockFileUploadRepository } from "./file-upload-repository";
import { AssignmentStatus } from "@/lib/domain/assignment";
import { JudgeStatus } from "@/lib/domain/judge";
import { HackathonStatus } from "@/lib/domain/hackathon";
import { ApplicationFormStatus } from "@/lib/domain/application-form";
import { QuestionType } from "@/lib/domain/application-form-question";
import {
  HACKATHON_ID,
  PUBLISHED_HACKATHON_ID,
  PUBLISHED_HACKATHON_SLUG,
  ARCHIVED_HACKATHON_ID,
  ARCHIVED_HACKATHON_SLUG,
} from "@/mock-data/hackathons";
import { CLIENT_ID } from "@/mock-data/clients";
import {
  APPLICATION_FORM_ID,
  PUBLISHED_APPLICATION_FORM_ID,
} from "@/mock-data/application-forms";

beforeEach(() => {
  resetMockStore();
});

describe("MockAssignmentRepository", () => {
  it("rejects a duplicate (judge, project) assignment", async () => {
    const repo = new MockAssignmentRepository();
    await expect(
      repo.create({
        hackathonId: HACKATHON_ID,
        judgeId: "judge-ahmad",
        projectId: "project-001",
      })
    ).rejects.toThrow();
  });

  it("allows a new (judge, project) pair not already assigned", async () => {
    const repo = new MockAssignmentRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      judgeId: "judge-faisal",
      projectId: "project-001",
    });
    expect(created.status).toBe(AssignmentStatus.Pending);
  });
});

describe("MockEvaluationRepository", () => {
  it("submitting an evaluation marks the assignment completed", async () => {
    const assignmentRepo = new MockAssignmentRepository();
    const evaluationRepo = new MockEvaluationRepository();

    const assignment = await assignmentRepo.create({
      hackathonId: HACKATHON_ID,
      judgeId: "judge-faisal",
      projectId: "project-002",
    });

    await evaluationRepo.submit("judge-faisal", {
      assignmentId: assignment.id,
      scores: [
        { criterionId: "criterion-innovation", score: 8 },
        { criterionId: "criterion-impact", score: 9 },
        { criterionId: "criterion-feasibility", score: 7 },
        { criterionId: "criterion-presentation", score: 8 },
      ],
    });

    const updated = await assignmentRepo.getById(assignment.id);
    expect(updated?.status).toBe(AssignmentStatus.Completed);
  });

  it("rejects a second submission on an already-submitted evaluation", async () => {
    const evaluationRepo = new MockEvaluationRepository();

    // assign-001 (judge-ahmad, project-001) is already submitted in fixtures.
    await expect(
      evaluationRepo.submit("judge-ahmad", {
        assignmentId: "assign-001",
        scores: [
          { criterionId: "criterion-innovation", score: 5 },
          { criterionId: "criterion-impact", score: 5 },
          { criterionId: "criterion-feasibility", score: 5 },
          { criterionId: "criterion-presentation", score: 5 },
        ],
      })
    ).rejects.toThrow();
  });

  it("rejects submission by a judge who does not own the assignment", async () => {
    const evaluationRepo = new MockEvaluationRepository();
    await expect(
      evaluationRepo.submit("judge-mohammed", {
        assignmentId: "assign-001", // belongs to judge-ahmad
        scores: [
          { criterionId: "criterion-innovation", score: 5 },
          { criterionId: "criterion-impact", score: 5 },
          { criterionId: "criterion-feasibility", score: 5 },
          { criterionId: "criterion-presentation", score: 5 },
        ],
      })
    ).rejects.toThrow();
  });

  it("reopen unlocks a submitted evaluation and reverts assignment to in_progress", async () => {
    const evaluationRepo = new MockEvaluationRepository();
    const assignmentRepo = new MockAssignmentRepository();

    const evaluation = await evaluationRepo.getByAssignmentId("assign-001");
    expect(evaluation).not.toBeNull();

    const reopened = await evaluationRepo.reopen(evaluation!.id, "user-admin-demo");
    expect(reopened.status).toBe("draft");

    const assignment = await assignmentRepo.getById("assign-001");
    expect(assignment?.status).toBe(AssignmentStatus.InProgress);

    // Now resubmission should succeed since it is no longer locked.
    const resubmitted = await evaluationRepo.submit("judge-ahmad", {
      assignmentId: "assign-001",
      scores: [
        { criterionId: "criterion-innovation", score: 10 },
        { criterionId: "criterion-impact", score: 10 },
        { criterionId: "criterion-feasibility", score: 10 },
        { criterionId: "criterion-presentation", score: 10 },
      ],
    });
    expect(resubmitted.status).toBe("submitted");
  });
});

describe("MockResultsRepository", () => {
  it("computes complete projects with a final score and rank", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);

    const complete = results.filter((r) => r.isComplete);
    expect(complete.length).toBeGreaterThan(0);
    complete.forEach((r) => {
      expect(r.finalScore).not.toBeNull();
      expect(r.rank).not.toBeNull();
    });
  });

  it("never assigns a rank or final score to an incomplete project", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);

    const incomplete = results.filter((r) => !r.isComplete);
    expect(incomplete.length).toBeGreaterThan(0);
    incomplete.forEach((r) => {
      expect(r.finalScore).toBeNull();
      expect(r.rank).toBeNull();
    });
  });

  it("orders complete projects by descending final score", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);
    const completeScores = results
      .filter((r) => r.isComplete && r.finalScore !== null)
      .map((r) => r.finalScore as number);

    for (let i = 1; i < completeScores.length; i++) {
      expect(completeScores[i]).toBeLessThanOrEqual(completeScores[i - 1]);
    }
  });
});

describe("MockClientRepository", () => {
  it("rejects deleting a client that still has competitions (mirrors ON DELETE RESTRICT)", async () => {
    const repo = new MockClientRepository();
    // CLIENT_ID owns HACKATHON_ID in the seeded fixtures.
    await expect(repo.delete(CLIENT_ID)).rejects.toThrow();

    const stillThere = await repo.getById(CLIENT_ID);
    expect(stillThere).not.toBeNull();
  });

  it("allows deleting a client with no competitions", async () => {
    const repo = new MockClientRepository();
    const created = await repo.create({
      name: "عميل بدون مسابقات",
      contactEmail: "",
      contactPhone: "",
      notes: "",
    });

    await expect(repo.delete(created.id)).resolves.toBeUndefined();
    expect(await repo.getById(created.id)).toBeNull();
  });
});

describe("MockHackathonRepository", () => {
  it("creates a competition associated with the given client, unpublished by default", async () => {
    const repo = new MockHackathonRepository();
    const created = await repo.create({
      name: "مسابقة جديدة",
      description: "",
      clientId: CLIENT_ID,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      status: HackathonStatus.Draft,
    });

    expect(created.clientId).toBe(CLIENT_ID);
    expect(created.isPublished).toBe(false);
  });

  it("toggles isPublished independently of the internal judging status", async () => {
    const repo = new MockHackathonRepository();

    const published = await repo.update({
      id: HACKATHON_ID,
      isPublished: true,
    });
    expect(published.isPublished).toBe(true);
    // Toggling publication must not touch the unrelated judging-workflow status.
    expect(published.status).toBe(HackathonStatus.OpenForEvaluation);

    const unpublished = await repo.update({
      id: HACKATHON_ID,
      isPublished: false,
    });
    expect(unpublished.isPublished).toBe(false);
  });

  it("saves branding fields (logo, hero image, colors)", async () => {
    const repo = new MockHackathonRepository();
    const updated = await repo.update({
      id: HACKATHON_ID,
      logoUrl: "https://example.com/logo.png",
      heroImageUrl: "https://example.com/hero.jpg",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      accentColor: "#778899",
    });

    expect(updated.logoUrl).toBe("https://example.com/logo.png");
    expect(updated.heroImageUrl).toBe("https://example.com/hero.jpg");
    expect(updated.primaryColor).toBe("#112233");
    expect(updated.secondaryColor).toBe("#445566");
    expect(updated.accentColor).toBe("#778899");
  });

  it("saves landing content as plain text", async () => {
    const repo = new MockHackathonRepository();
    const updated = await repo.update({
      id: HACKATHON_ID,
      landingContent: "مرحبًا بكم في المسابقة!",
    });
    expect(updated.landingContent).toBe("مرحبًا بكم في المسابقة!");
  });

  it("assigns a unique slug to a competition", async () => {
    const repo = new MockHackathonRepository();
    const updated = await repo.update({
      id: HACKATHON_ID,
      slug: "innovation-2026",
    });
    expect(updated.slug).toBe("innovation-2026");
  });

  it("rejects a slug already used by another competition (mirrors hackathons_slug_key)", async () => {
    const repo = new MockHackathonRepository();
    await repo.update({ id: HACKATHON_ID, slug: "taken-slug" });

    const other = await repo.create({
      name: "مسابقة أخرى",
      description: "",
      clientId: CLIENT_ID,
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      status: HackathonStatus.Draft,
    });

    await expect(
      repo.update({ id: other.id, slug: "taken-slug" })
    ).rejects.toThrow();
  });

  it("allows re-saving a competition's own current slug unchanged", async () => {
    const repo = new MockHackathonRepository();
    await repo.update({ id: HACKATHON_ID, slug: "my-own-slug" });

    await expect(
      repo.update({ id: HACKATHON_ID, slug: "my-own-slug", name: "اسم محدث" })
    ).resolves.toMatchObject({ slug: "my-own-slug", name: "اسم محدث" });
  });

  it("allows two competitions to both have no slug (partial-unique semantics)", async () => {
    const repo = new MockHackathonRepository();
    const other = await repo.create({
      name: "مسابقة بدون معرّف",
      description: "",
      clientId: CLIENT_ID,
      startDate: "2026-12-01",
      endDate: "2026-12-03",
      status: HackathonStatus.Draft,
    });

    // Neither HACKATHON_ID nor `other` has a slug set — this must not
    // collide, matching the DB's `UNIQUE(slug) WHERE slug IS NOT NULL`.
    const original = await repo.getById(HACKATHON_ID);
    expect(original?.slug).toBeUndefined();
    expect(other.slug).toBeUndefined();
  });

  it("list() excludes archived competitions", async () => {
    const repo = new MockHackathonRepository();
    const active = await repo.list();
    expect(active.some((h) => h.id === ARCHIVED_HACKATHON_ID)).toBe(false);
    // Sanity: the other fixtures are still there.
    expect(active.some((h) => h.id === HACKATHON_ID)).toBe(true);
  });

  it("listArchived() includes only archived competitions", async () => {
    const repo = new MockHackathonRepository();
    const archived = await repo.listArchived();
    expect(archived.map((h) => h.id)).toEqual([ARCHIVED_HACKATHON_ID]);
    expect(archived[0].archivedAt).toBeTruthy();
  });

  it("archiveHackathon() sets archivedAt and moves the competition out of list()", async () => {
    const repo = new MockHackathonRepository();
    expect((await repo.getById(HACKATHON_ID))?.archivedAt).toBeUndefined();

    const archived = await repo.archiveHackathon(HACKATHON_ID);
    expect(archived.archivedAt).toBeTruthy();

    const active = await repo.list();
    expect(active.some((h) => h.id === HACKATHON_ID)).toBe(false);

    const archivedList = await repo.listArchived();
    expect(archivedList.some((h) => h.id === HACKATHON_ID)).toBe(true);
  });

  it("archiving never changes status or isPublished", async () => {
    const repo = new MockHackathonRepository();
    const before = await repo.getById(PUBLISHED_HACKATHON_ID);
    const archived = await repo.archiveHackathon(PUBLISHED_HACKATHON_ID);

    expect(archived.status).toBe(before?.status);
    expect(archived.isPublished).toBe(before?.isPublished);
  });

  it("restoreHackathon() clears archivedAt and returns the competition to list()", async () => {
    const repo = new MockHackathonRepository();
    const restored = await repo.restoreHackathon(ARCHIVED_HACKATHON_ID);
    expect(restored.archivedAt).toBeUndefined();

    const active = await repo.list();
    expect(active.some((h) => h.id === ARCHIVED_HACKATHON_ID)).toBe(true);

    const archivedList = await repo.listArchived();
    expect(archivedList.some((h) => h.id === ARCHIVED_HACKATHON_ID)).toBe(false);
  });

  it("archiving preserves every field on the hackathon row itself", async () => {
    const repo = new MockHackathonRepository();
    const before = await repo.getById(HACKATHON_ID);
    const archived = await repo.archiveHackathon(HACKATHON_ID);

    expect(archived.name).toBe(before?.name);
    expect(archived.description).toBe(before?.description);
    expect(archived.clientId).toBe(before?.clientId);
    expect(archived.startDate).toBe(before?.startDate);
    expect(archived.endDate).toBe(before?.endDate);
  });

  it("archive then restore round-trips back to the original active state", async () => {
    const repo = new MockHackathonRepository();
    await repo.archiveHackathon(HACKATHON_ID);
    const restored = await repo.restoreHackathon(HACKATHON_ID);

    expect(restored.archivedAt).toBeUndefined();
    const active = await repo.list();
    expect(active.some((h) => h.id === HACKATHON_ID)).toBe(true);
  });
});

describe("MockPublishedCompetitionRepository — archived competitions", () => {
  it("an archived-but-published competition is no longer resolvable by slug", async () => {
    const repo = new MockPublishedCompetitionRepository();
    // ARCHIVED_HACKATHON_ID's fixture is isPublished: true AND archived —
    // the realistic "was live, then archived" case.
    const result = await repo.getBySlug(ARCHIVED_HACKATHON_SLUG);
    expect(result).toBeNull();
  });

  it("restoring a previously-published competition makes it resolvable by slug again", async () => {
    const hackathonRepo = new MockHackathonRepository();
    const publishedRepo = new MockPublishedCompetitionRepository();

    expect(await publishedRepo.getBySlug(ARCHIVED_HACKATHON_SLUG)).toBeNull();
    await hackathonRepo.restoreHackathon(ARCHIVED_HACKATHON_ID);
    const result = await publishedRepo.getBySlug(ARCHIVED_HACKATHON_SLUG);
    expect(result?.id).toBe(ARCHIVED_HACKATHON_ID);
  });

  it("archiving a currently-published competition immediately hides it from published lookups", async () => {
    const hackathonRepo = new MockHackathonRepository();
    const publishedRepo = new MockPublishedCompetitionRepository();

    expect((await publishedRepo.getBySlug(PUBLISHED_HACKATHON_SLUG))?.id).toBe(
      PUBLISHED_HACKATHON_ID
    );
    await hackathonRepo.archiveHackathon(PUBLISHED_HACKATHON_ID);
    expect(await publishedRepo.getBySlug(PUBLISHED_HACKATHON_SLUG)).toBeNull();
  });
});

describe("MockApplicationFormRepository", () => {
  it("returns null when the competition has no form yet", async () => {
    const repo = new MockApplicationFormRepository();
    const hackathonRepo = new MockHackathonRepository();
    const created = await hackathonRepo.create({
      name: "مسابقة بلا نموذج",
      description: "",
      clientId: CLIENT_ID,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      status: HackathonStatus.Draft,
    });

    expect(await repo.getByHackathon(created.id)).toBeNull();
  });

  it("returns the seeded form for the fixture competition", async () => {
    const repo = new MockApplicationFormRepository();
    const form = await repo.getByHackathon(HACKATHON_ID);
    expect(form?.id).toBe(APPLICATION_FORM_ID);
    expect(form?.status).toBe(ApplicationFormStatus.Draft);
  });

  it("rejects creating a second form for a competition that already has one", async () => {
    const repo = new MockApplicationFormRepository();
    await expect(
      repo.create({ hackathonId: HACKATHON_ID, title: "نموذج ثانٍ" })
    ).rejects.toThrow();
  });

  it("creates a form for a competition that has none yet", async () => {
    const repo = new MockApplicationFormRepository();
    const hackathonRepo = new MockHackathonRepository();
    const hackathon = await hackathonRepo.create({
      name: "مسابقة جديدة بلا نموذج",
      description: "",
      clientId: CLIENT_ID,
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      status: HackathonStatus.Draft,
    });

    const form = await repo.create({
      hackathonId: hackathon.id,
      title: "نموذج التقديم الجديد",
    });
    expect(form.status).toBe(ApplicationFormStatus.Draft);
    expect(form.hackathonId).toBe(hackathon.id);
  });

  it("toggles publication status independently of anything else", async () => {
    const repo = new MockApplicationFormRepository();
    const published = await repo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });
    expect(published.status).toBe(ApplicationFormStatus.Published);

    const draft = await repo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Draft,
    });
    expect(draft.status).toBe(ApplicationFormStatus.Draft);
  });
});

describe("MockApplicationFormQuestionRepository", () => {
  it("lists a form's questions ordered deterministically", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    expect(questions.length).toBeGreaterThan(0);
    for (let i = 1; i < questions.length; i++) {
      expect(questions[i].order).toBeGreaterThanOrEqual(questions[i - 1].order);
    }
  });

  it("creates a short_text question with no options required", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const created = await repo.create({
      formId: APPLICATION_FORM_ID,
      questionText: "سؤال جديد",
      questionType: QuestionType.ShortText,
      isRequired: true,
      isEnabled: true,
      order: 99,
    });
    expect(created.questionType).toBe(QuestionType.ShortText);
    expect(created.options).toBeUndefined();
  });

  it("rejects creating a single_choice question with no options (mirrors DB CHECK)", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    await expect(
      repo.create({
        formId: APPLICATION_FORM_ID,
        questionText: "سؤال اختيار",
        questionType: QuestionType.SingleChoice,
        options: [],
        isRequired: true,
        isEnabled: true,
        order: 99,
      })
    ).rejects.toThrow();
  });

  it("creates a single_choice question with options", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const created = await repo.create({
      formId: APPLICATION_FORM_ID,
      questionText: "المسار",
      questionType: QuestionType.SingleChoice,
      options: ["أ", "ب"],
      isRequired: true,
      isEnabled: true,
      order: 99,
    });
    expect(created.options).toEqual(["أ", "ب"]);
  });

  it("toggles isEnabled without deleting the question", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    const target = questions[0];

    const disabled = await repo.update({ id: target.id, isEnabled: false });
    expect(disabled.isEnabled).toBe(false);

    const stillListed = await repo.listByForm(APPLICATION_FORM_ID);
    expect(stillListed.some((q) => q.id === target.id)).toBe(true);
  });

  it("rejects clearing options on an update that keeps questionType as single_choice", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    const choiceQuestion = questions.find(
      (q) => q.questionType === QuestionType.SingleChoice
    );
    expect(choiceQuestion).toBeDefined();

    await expect(
      repo.update({ id: choiceQuestion!.id, options: [] })
    ).rejects.toThrow();
  });

  it("persists a new order across all questions when reordering", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    const reversedIds = [...questions].reverse().map((q) => q.id);

    await Promise.all(
      reversedIds.map((id, index) => repo.update({ id, order: index }))
    );

    const reordered = await repo.listByForm(APPLICATION_FORM_ID);
    expect(reordered.map((q) => q.id)).toEqual(reversedIds);
  });

  it("reports hasAnswers=true for a question with historical answers", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    // The mock store seeds the first fixture question as having an answer
    // (see lib/data/mock/store.ts cloneFixtures()).
    expect(await repo.hasAnswers(questions[0].id)).toBe(true);
  });

  it("reports hasAnswers=false for a question with no historical answers", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const created = await repo.create({
      formId: APPLICATION_FORM_ID,
      questionText: "سؤال بلا إجابات",
      questionType: QuestionType.ShortText,
      isRequired: false,
      isEnabled: true,
      order: 100,
    });
    expect(await repo.hasAnswers(created.id)).toBe(false);
  });

  it("prevents deleting a question that has historical answers, and keeps it intact", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const questions = await repo.listByForm(APPLICATION_FORM_ID);
    const questionWithAnswers = questions[0];

    await expect(repo.delete(questionWithAnswers.id)).rejects.toThrow();

    const stillThere = await repo.listByForm(APPLICATION_FORM_ID);
    expect(stillThere.some((q) => q.id === questionWithAnswers.id)).toBe(true);
  });

  it("allows deleting a question with no historical answers", async () => {
    const repo = new MockApplicationFormQuestionRepository();
    const created = await repo.create({
      formId: APPLICATION_FORM_ID,
      questionText: "سؤال يمكن حذفه",
      questionType: QuestionType.ShortText,
      isRequired: false,
      isEnabled: true,
      order: 101,
    });

    await expect(repo.delete(created.id)).resolves.toBeUndefined();
    const remaining = await repo.listByForm(APPLICATION_FORM_ID);
    expect(remaining.some((q) => q.id === created.id)).toBe(false);
  });
});

describe("MockPublishedCompetitionRepository", () => {
  it("returns the published competition by slug", async () => {
    const repo = new MockPublishedCompetitionRepository();
    const result = await repo.getBySlug(PUBLISHED_HACKATHON_SLUG);
    expect(result?.id).toBe(PUBLISHED_HACKATHON_ID);
    expect(result?.slug).toBe(PUBLISHED_HACKATHON_SLUG);
  });

  it("never exposes clientId or status even though the underlying fixture has them", async () => {
    const repo = new MockPublishedCompetitionRepository();
    const result = await repo.getBySlug(PUBLISHED_HACKATHON_SLUG);
    expect(result).not.toBeNull();
    expect("clientId" in (result as object)).toBe(false);
    expect("status" in (result as object)).toBe(false);
  });

  it("returns null for a slug belonging to an unpublished competition", async () => {
    // HACKATHON_ID's fixture has isPublished: false and no slug at all, so
    // there is no slug that could ever resolve to it through this repository.
    const repo = new MockPublishedCompetitionRepository();
    const result = await repo.getBySlug("innovation-2026");
    expect(result).toBeNull();
  });

  it("returns null for a slug that does not exist", async () => {
    const repo = new MockPublishedCompetitionRepository();
    const result = await repo.getBySlug("no-such-slug");
    expect(result).toBeNull();
  });
});

describe("MockPublicApplicationRepository (single-call submit(), no file questions)", () => {
  // APPLICATION_FORM_ID's questions (form-question-*) have no file_upload
  // question, so this remains a valid exercise of the single-call path —
  // PUBLISHED_APPLICATION_FORM_ID now has a required file_upload question
  // (pub-question-resume) and must go through initiate()/finalize() instead
  // (see the describe block below), exactly like the real public UI's
  // hasFileQuestions branch (components/public/application-form-section.tsx).
  const validAnswers = [
    { questionId: "form-question-team-name", answerText: "فريق تجريبي" },
    { questionId: "form-question-idea-summary", answerText: "فكرة مبتكرة" },
    { questionId: "form-question-track", answerText: "التعليم" },
    { questionId: "form-question-team-size", answerText: "3" },
    { questionId: "form-question-contact-email", answerText: "team@example.com" },
    // Demo Mode additions (mock-application-form-questions.ts) — also
    // required, so a "valid" submission must answer these too.
    { questionId: "form-question-age", answerText: "2000-01-01" },
    { questionId: "form-question-location", answerText: "الرياض" },
    { questionId: "form-question-university", answerText: "جامعة الملك سعود" },
    { questionId: "form-question-major", answerText: "علوم الحاسب" },
    { questionId: "form-question-motivation", answerText: "أرغب في تطوير مهاراتي." },
    { questionId: "form-question-project-idea", answerText: "فكرة مشروع تجريبية للاختبار." },
  ];

  it("submits a valid application successfully", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    // form-question-* belongs to APPLICATION_FORM_ID, which is 'draft' by
    // fixture default — publish it first so submit() doesn't reject on
    // form status (a separate concern from what this test exercises).
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    const result = await repo.submit({
      hackathonId: HACKATHON_ID,
      formId: APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "team@example.com",
      answers: validAnswers,
    });
    expect(result.status).toBe("submitted");
    expect(result.applicationId).toBeTruthy();
  });

  it("rejects a submission to a draft form", async () => {
    const repo = new MockPublicApplicationRepository();
    await expect(
      repo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID, // draft, per fixtures
        fullName: "شخص ما",
        email: "someone@example.com",
        answers: [],
      })
    ).rejects.toThrow();
  });

  it("rejects a submission to an archived competition even when its form is published", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    const hackathonRepo = new MockHackathonRepository();

    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });
    await hackathonRepo.archiveHackathon(HACKATHON_ID);

    await expect(
      publicRepo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID,
        fullName: "شخص ما",
        email: "archived-submit@example.com",
        answers: [],
      })
    ).rejects.toThrow();
  });

  it("rejects a missing required answer", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    await expect(
      repo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID,
        fullName: "قائد الفريق",
        email: "incomplete@example.com",
        answers: validAnswers.filter(
          (a) => a.questionId !== "form-question-team-name"
        ),
      })
    ).rejects.toThrow();
  });

  it("rejects a single_choice answer outside the configured options", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    await expect(
      repo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID,
        fullName: "قائد الفريق",
        email: "invalid-choice@example.com",
        answers: validAnswers.map((a) =>
          a.questionId === "form-question-track"
            ? { ...a, answerText: "خيار غير موجود" }
            : a
        ),
      })
    ).rejects.toThrow();
  });

  it("rejects a non-numeric answer to a number question", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    await expect(
      repo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID,
        fullName: "قائد الفريق",
        email: "bad-number@example.com",
        answers: validAnswers.map((a) =>
          a.questionId === "form-question-team-size"
            ? { ...a, answerText: "ليس رقمًا" }
            : a
        ),
      })
    ).rejects.toThrow();
  });

  it("rejects a duplicate submission from the same email to the same competition", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    const payload = {
      hackathonId: HACKATHON_ID,
      formId: APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "duplicate@example.com",
      answers: validAnswers,
    };

    await repo.submit(payload);
    await expect(repo.submit(payload)).rejects.toThrow();
  });

  it("rejects answering a question that does not belong to the form", async () => {
    const repo = new MockPublicApplicationRepository();
    const formRepo = new MockApplicationFormRepository();
    await formRepo.update({
      id: APPLICATION_FORM_ID,
      status: ApplicationFormStatus.Published,
    });

    await expect(
      repo.submit({
        hackathonId: HACKATHON_ID,
        formId: APPLICATION_FORM_ID,
        fullName: "قائد الفريق",
        email: "foreign-question@example.com",
        answers: [
          ...validAnswers,
          { questionId: "pub-question-full-name", answerText: "x" },
        ],
      })
    ).rejects.toThrow();
  });
});

describe("MockPublicApplicationRepository (two-step flow: initiate -> register file -> finalize)", () => {
  // PUBLISHED_APPLICATION_FORM_ID has a required file_upload question
  // (pub-question-resume), so it must go through initiate()/finalize()
  // rather than the single-call submit() — exactly matching
  // components/public/application-form-section.tsx's own hasFileQuestions
  // branch.
  const nonFileAnswers = [
    { questionId: "pub-question-full-name", answerText: "فريق تجريبي" },
    { questionId: "pub-question-idea", answerText: "فكرة مبتكرة لحل مشكلة النقل" },
    { questionId: "pub-question-track", answerText: "المدن الذكية" },
    { questionId: "pub-question-team-size", answerText: "3" },
    { questionId: "pub-question-email", answerText: "team@example.com" },
  ];

  it("rejects initiate() for an archived competition even though its form is published", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const hackathonRepo = new MockHackathonRepository();
    await hackathonRepo.archiveHackathon(PUBLISHED_HACKATHON_ID);

    await expect(
      publicRepo.initiate({
        hackathonId: PUBLISHED_HACKATHON_ID,
        formId: PUBLISHED_APPLICATION_FORM_ID,
        fullName: "قائد الفريق",
        email: "archived-initiate@example.com",
      })
    ).rejects.toThrow();
  });

  it("creates a draft application via initiate()", async () => {
    const repo = new MockPublicApplicationRepository();
    const draft = await repo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "initiate-1@example.com",
    });
    expect(draft.status).toBe("draft");
    expect(draft.applicationId).toBeTruthy();
  });

  it("reuses an existing draft for the same applicant/form instead of creating a second one", async () => {
    const repo = new MockPublicApplicationRepository();
    const input = {
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "reuse@example.com",
    };
    const first = await repo.initiate(input);
    const second = await repo.initiate(input);
    expect(second.applicationId).toBe(first.applicationId);
  });

  it("rejects finalize() without the required file having been registered", async () => {
    const repo = new MockPublicApplicationRepository();
    const draft = await repo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "missing-file@example.com",
    });

    await expect(
      repo.finalize({ applicationId: draft.applicationId, answers: nonFileAnswers })
    ).rejects.toThrow();
  });

  it("registers a file via the file-upload repository and finalizes successfully", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "with-file@example.com",
    });

    const registered = await fileRepo.uploadAndRegister(
      draft.applicationId,
      "pub-question-resume",
      { name: "cv.pdf", type: "application/pdf", size: 1024 }
    );
    expect(registered.path).toBe(
      `applications/${draft.applicationId}/pub-question-resume/cv.pdf`
    );

    const result = await publicRepo.finalize({
      applicationId: draft.applicationId,
      answers: nonFileAnswers,
    });
    expect(result.status).toBe("submitted");
  });

  it("rejects an unsupported file type at the upload step", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "bad-type@example.com",
    });

    await expect(
      fileRepo.uploadAndRegister(draft.applicationId, "pub-question-resume", {
        name: "malware.exe",
        type: "application/x-msdownload",
        size: 1024,
      })
    ).rejects.toThrow();
  });

  it("rejects registering a file for a question that does not accept file uploads", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "wrong-question@example.com",
    });

    await expect(
      fileRepo.uploadAndRegister(draft.applicationId, "pub-question-full-name", {
        name: "cv.pdf",
        type: "application/pdf",
        size: 1024,
      })
    ).rejects.toThrow();
  });

  it("replacing a file for the same question keeps only the latest registration", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "replace@example.com",
    });

    await fileRepo.uploadAndRegister(draft.applicationId, "pub-question-resume", {
      name: "cv-draft.pdf",
      type: "application/pdf",
      size: 1024,
    });
    const replaced = await fileRepo.uploadAndRegister(
      draft.applicationId,
      "pub-question-resume",
      { name: "cv-final.pdf", type: "application/pdf", size: 2048 }
    );

    expect(replaced.path).toContain("cv-final.pdf");

    const result = await publicRepo.finalize({
      applicationId: draft.applicationId,
      answers: nonFileAnswers,
    });
    expect(result.status).toBe("submitted");
  });

  it("rejects finalize() for an already-submitted application", async () => {
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "double-finalize@example.com",
    });
    await fileRepo.uploadAndRegister(draft.applicationId, "pub-question-resume", {
      name: "cv.pdf",
      type: "application/pdf",
      size: 1024,
    });
    await publicRepo.finalize({
      applicationId: draft.applicationId,
      answers: nonFileAnswers,
    });

    await expect(
      publicRepo.finalize({
        applicationId: draft.applicationId,
        answers: nonFileAnswers,
      })
    ).rejects.toThrow();
  });

  it("disabled questions are excluded from required-answer validation", async () => {
    // pub-question-disabled-legacy is isEnabled: false and isRequired: false
    // in the fixtures — confirms a disabled question never blocks finalize()
    // regardless of whether it was answered.
    const publicRepo = new MockPublicApplicationRepository();
    const fileRepo = new MockFileUploadRepository();

    const draft = await publicRepo.initiate({
      hackathonId: PUBLISHED_HACKATHON_ID,
      formId: PUBLISHED_APPLICATION_FORM_ID,
      fullName: "قائد الفريق",
      email: "disabled-question@example.com",
    });
    await fileRepo.uploadAndRegister(draft.applicationId, "pub-question-resume", {
      name: "cv.pdf",
      type: "application/pdf",
      size: 1024,
    });

    const result = await publicRepo.finalize({
      applicationId: draft.applicationId,
      answers: nonFileAnswers, // no answer for pub-question-disabled-legacy
    });
    expect(result.status).toBe("submitted");
  });
});

describe("MockJudgeRepository — invitation/account-management fields", () => {
  it("create() persists phone and notes alongside the existing fields", async () => {
    const repo = new MockJudgeRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      name: "طارق العمري",
      email: "tariq.alomari@example.com",
      phone: "0501112222",
      notes: "خبير في أمن المعلومات",
      status: JudgeStatus.Active,
    });
    expect(created.phone).toBe("0501112222");
    expect(created.notes).toBe("خبير في أمن المعلومات");
    expect(created.status).toBe("active");
  });

  it("update() can change status independently (activate/deactivate)", async () => {
    const repo = new MockJudgeRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      name: "لمى الغامدي",
      email: "lama.alghamdi@example.com",
      status: JudgeStatus.Active,
    });
    expect(created.status).toBe("active");

    const disabled = await repo.update({ id: created.id, status: JudgeStatus.Inactive });
    expect(disabled.status).toBe("inactive");
    // Disabling never touches name/email — matches the "never delete
    // evaluation history when disabling a judge" requirement structurally:
    // nothing about this call removes or reassigns the judges row itself.
    expect(disabled.name).toBe("لمى الغامدي");
    expect(disabled.email).toBe("lama.alghamdi@example.com");

    const reEnabled = await repo.update({ id: created.id, status: JudgeStatus.Active });
    expect(reEnabled.status).toBe("active");
  });

  it("getByEmail() finds a judge case-insensitively", async () => {
    const repo = new MockJudgeRepository();
    await repo.create({
      hackathonId: HACKATHON_ID,
      name: "بدر السبيعي",
      email: "Badr.Alsubaie@example.com",
      status: JudgeStatus.Active,
    });
    const found = await repo.getByEmail("badr.alsubaie@example.com");
    expect(found?.name).toBe("بدر السبيعي");
  });
});

describe("MockAuthRepository (prototype auth)", () => {
  it("signs in the demo admin account", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn("admin@innovationraces.demo", "any-password");
    expect(user?.role).toBe("admin");
  });

  it("signs in a seeded judge by real email", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn(
      "ahmad.almutairi@innovationraces.demo",
      "any-password"
    );
    expect(user?.role).toBe("judge");
    expect(user?.judgeId).toBe("judge-ahmad");
  });

  it("returns null for an unknown email", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn("unknown@example.com", "x");
    expect(user).toBeNull();
  });

  it("a disabled (inactive) judge cannot sign in — account disabling is enforced, not just cosmetic", async () => {
    // judge-faisal (faisal.alharbi@innovationraces.demo) is seeded as
    // JudgeStatus.Inactive in mock-data/judges.ts — mirrors
    // buildDomainUser()'s own `.eq("status", "active")` filter
    // (lib/data/supabase/shared.ts) for the real backend.
    const repo = new MockAuthRepository();
    const user = await repo.signIn("faisal.alharbi@innovationraces.demo", "any-password");
    expect(user).toBeNull();
  });

  it("re-activating a disabled judge restores sign-in", async () => {
    const judgeRepo = new MockJudgeRepository();
    const authRepo = new MockAuthRepository();

    const created = await judgeRepo.create({
      hackathonId: HACKATHON_ID,
      name: "منى الزهراني",
      email: "mona.alzahrani@example.com",
      status: JudgeStatus.Inactive,
    });
    expect(await authRepo.signIn(created.email, "any-password")).toBeNull();

    await judgeRepo.update({ id: created.id, status: JudgeStatus.Active });
    const reActivatedUser = await authRepo.signIn(created.email, "any-password");
    expect(reActivatedUser?.role).toBe("judge");
    expect(reActivatedUser?.judgeId).toBe(created.id);
  });
});

describe("HackathonRepository — mock/Supabase parity", () => {
  it("both implementations expose the same archiving methods", async () => {
    // Both classes `implements HackathonRepository` (checked by tsc at
    // compile time — a missing method on either class already fails the
    // build), so this is a lightweight runtime cross-check, not the
    // primary guarantee. Only instantiates the Supabase repository (never
    // calls a method on it, so getSupabaseBrowserClient()'s
    // env-var-or-throw guard — lib/supabase/client.ts — is never reached)
    // purely to read its prototype's method names.
    const { SupabaseHackathonRepository } = await import(
      "@/lib/data/supabase/hackathon-repository"
    );

    const mockMethods = Object.getOwnPropertyNames(
      MockHackathonRepository.prototype
    ).filter((m) => m !== "constructor");
    const supabaseMethods = Object.getOwnPropertyNames(
      SupabaseHackathonRepository.prototype
    ).filter((m) => m !== "constructor");

    for (const method of [
      "list",
      "listArchived",
      "getById",
      "create",
      "update",
      "archiveHackathon",
      "restoreHackathon",
    ]) {
      expect(mockMethods).toContain(method);
      expect(supabaseMethods).toContain(method);
    }
  });
});
