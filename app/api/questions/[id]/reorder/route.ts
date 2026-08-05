import { reorderQuestion } from "@/lib/data/questions";
import { reorderQuestionSchema } from "@/lib/validation/schemas";
import { handle, json, parseBody } from "@/lib/data/respond";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const { afterId } = await parseBody(req, reorderQuestionSchema);
    return json(await reorderQuestion(id, afterId));
  });
}
