exports.validateBuild = (result, platform, profile, commit, projectId) => {
  const list = Array.isArray(result) ? result : [result];
  if (list.length !== 1) throw new Error('Expected one exact build result');
  const build = list[0];
  if (!build || typeof build.id !== 'string' || build.status !== 'FINISHED' || build.platform !== platform.toUpperCase() || build.buildProfile !== profile || !commit || build.gitCommitHash !== commit || build.project?.id !== projectId) throw new Error('Build status, platform, profile, commit or project does not match this release');
  return build;
};
