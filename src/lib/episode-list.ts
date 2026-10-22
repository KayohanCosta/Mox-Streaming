import type { Episode } from './tmdb';
import type { EpisodeSource } from './redecanais';

// Supplement incomplete metadata only with episode numbers explicitly observed
// in the matched origin list. Absolute numbering is safe only for one season.
export function completeEpisodeList(metadata: Episode[], sources: EpisodeSource[] = [], season: number, seasonCount: number): Episode[] {
  const result = new Map(metadata.map(episode => [episode.episode_number, episode]));
  for (const source of sources) {
    if (source.season !== season && !(source.season === null && season === 1 && seasonCount === 1)) continue;
    if (result.has(source.episode)) continue;
    result.set(source.episode, { id: -source.episode, episode_number: source.episode, name: `Episódio ${source.episode}`, overview: '', still_path: null, vote_average: 0 });
  }
  return [...result.values()].sort((a,b) => a.episode_number - b.episode_number);
}
