import { BottomNav } from "@/components/BottomNav";

export default function GivePage() {
  return (
    <div className="app">
      <div className="top"><h1>Дарю</h1></div>
      <div className="empty">
        <b>Скоро</b>
        Здесь будут люди, которым вы дарите: повод, бюджет и колода их желаний.
      </div>
      <BottomNav active="give" />
    </div>
  );
}
