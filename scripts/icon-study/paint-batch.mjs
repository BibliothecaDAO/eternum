export async function paintBatch(jobs, generate, persist, preview) {
  await Promise.all(
    jobs.map(async (job) => {
      const result = await generate({
        prompt: job.prompt,
        referenced_image_paths: job.references,
        transparent_background: true,
      });
      const match = result.output_hint?.match(/as (\/\S+\.png) by default/);
      if (!match) throw new Error(`No saved master returned for ${job.key}`);
      await persist(job, match[1]);
      preview(job, result);
    }),
  );
}
