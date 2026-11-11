import { PawPeek, type PawPet } from "@/components/illustrations";
import { Card, PageHeader } from "@/components/ui";

/** Temporary content for routes that page builders will replace. */
export function PagePlaceholder({ title, description, note, pet = "ginger" }: { title: string; description: string; note: string; pet?: PawPet }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
        <PawPeek size={88} pet={pet} />
        <p className="font-display text-h2 font-extrabold">{note}</p>
      </Card>
    </div>
  );
}
