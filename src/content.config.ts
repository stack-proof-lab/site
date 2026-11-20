// Content collections for the stack proof. Every required field here is mirrored as required
// in public/admin/config.yml. The status enum is published | corrected only; pre-publish states
// live in Sveltia's editorial workflow.
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const md = (base: string) => glob({ pattern: '**/*.md', base });
const nonEmpty = z.string().trim().min(1);
const day = z.coerce.date();

// topics
const topics = defineCollection({
  loader: md('./src/content/topics'),
  schema: z.object({
    name: nonEmpty,
    question: nonEmpty,
    perspective: z.string().optional(),
    order: z.number().int(),
  }),
});

// sources: a source is a quotable record with a verified line, or it is not a source.
const sources = defineCollection({
  loader: md('./src/content/sources'),
  schema: z
    .object({
      kind: z.enum([
        'dataset',
        'publication',
        'act or regulation',
        'policy instrument',
        'legal provision',
      ]),
      ref: nonEmpty,
      title: nonEmpty,
      quote: nonEmpty,
      url: z.url().optional(),
      file: z.string().optional(),
      verified: z.object({ by: nonEmpty, date: day }),
    })
    .refine((s) => Boolean(s.url) !== Boolean(s.file), {
      message: 'A source needs exactly one of url or file.',
      path: ['url'],
    }),
});

// papers
const papers = defineCollection({
  loader: md('./src/content/papers'),
  schema: z.object({
    title: nonEmpty,
    finding: reference('findings').optional(),
    topic: reference('topics').optional(),
    kind: z.enum(['working paper', 'policy brief', 'research paper', 'other']),
    versions: z
      .array(
        z.object({
          file: nonEmpty,
          version: nonEmpty,
          date: day,
          note: z.string().optional(),
        }),
      )
      .min(1),
    citation: z.object({
      authors: z.array(nonEmpty).min(1),
      year: z.number().int(),
      publisher: nonEmpty,
      url: z.url().optional(),
    }),
  }),
});

// findings: a finding cannot be published without at least one source.
const findings = defineCollection({
  loader: md('./src/content/findings'),
  schema: z.object({
    title: nonEmpty,
    topic: reference('topics'),
    depth1: nonEmpty,
    sources: z.array(reference('sources')).min(1, 'A finding must cite at least one source.'),
    depth2: nonEmpty,
    depth3: reference('papers').optional(),
    // `people` is outside this proof's subset, so signoff.person is a name string standing in for
    // reference('people').
    signoff: z.object({ person: nonEmpty, date: day }),
    status: z.enum(['published', 'corrected']),
    published: day,
    updated: day.optional(),
  }),
});

// events
const events = defineCollection({
  loader: md('./src/content/events'),
  schema: z.object({
    title: nonEmpty,
    kind: z.enum(['conversation with partners', 'seminar', 'workshop', 'other']),
    partners: z.array(nonEmpty).optional(),
    date: day,
    endDate: day.optional(),
    place: z.string().optional(),
    description: nonEmpty,
    link: z.url().optional(),
    topic: reference('topics').optional(),
  }),
});

export const collections = { topics, sources, papers, findings, events };
