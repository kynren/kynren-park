import { useEffect, useState } from 'react';
import { AttractionListScreen } from './favorites';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export default function SeenScreen() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    api<{ attractionId: string }[]>('/me/seen')
      .then((s) => setIds(new Set(s.map((x) => x.attractionId))))
      .catch(() => setIds(new Set()));
  }, [user]);

  return (
    <AttractionListScreen
      title="I did it" label="I DID IT" slot="seen.empty"
      emptyHeading="Write your story at Kynren"
      emptyBody="Shows, restaurants and activities appear here when you mark them as done."
      ids={ids}
    />
  );
}
