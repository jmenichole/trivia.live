import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: showId } = await params;
  const body = await req.json();
  const { participantId, questionIndex, choiceId } = body as {
    participantId: string;
    questionIndex: number;
    choiceId: string;
  };

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: show } = await admin
    .from("shows")
    .select("current_phase, current_state, question_set_id")
    .eq("id", showId)
    .single();

  if (!show || show.current_phase !== "question") {
    return NextResponse.json({ error: "Not accepting answers" }, { status: 400 });
  }

  const runtime = show.current_state as { questionIndex: number };
  if (runtime.questionIndex !== questionIndex) {
    return NextResponse.json({ error: "Wrong question" }, { status: 400 });
  }

  const { data: question } = await admin
    .from("questions")
    .select("correct_choice_id")
    .eq("question_set_id", show.question_set_id)
    .eq("order_index", questionIndex + 1)
    .single();

  const correct = choiceId === question?.correct_choice_id;

  const { error } = await admin.from("answers").upsert(
    {
      show_id: showId,
      participant_id: participantId,
      question_index: questionIndex,
      choice_id: choiceId,
      correct,
    },
    { onConflict: "show_id,participant_id,question_index" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ accepted: true });
}
