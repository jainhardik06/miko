const token = process.argv[2];

async function main(){
  if(!token){
    console.error('token argument required');
    process.exit(1);
  }
  const res = await fetch('http://localhost:5001/api/admin/verification/queue?page=1&limit=20', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  console.log(res.status, text);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
