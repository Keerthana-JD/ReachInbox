import { pool } from "../db";

async function main() {
  await pool.query(
    `INSERT INTO senders (name, smtp_user, smtp_pass, max_emails_per_hour)
     VALUES
       ($1, $2, $3, $4),
       ($5, $6, $7, $8),
       ($9, $10, $11, $12)`,
    [
      "vvce23cs0200@vvce.ac.in",
      "tjmog3pk45khcysr@ethereal.email",
      "rVeaQfuFgrsRQRDTzJ",
      5,

      "oliverBrown@vvce.ac.in",
      "dayucwvpihruzoei@ethereal.email",
      "s8RBN9wxQw8a3ndgt8",
      5,

      "vvce23cs0202@vvce.ac.in",
      "lkur4udzgxrphecj@ethereal.email",
      "jxse4twBZf5aVEBzVs",
      5,
    ]
  );

  console.log("✅ Seeded 3 senders.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});