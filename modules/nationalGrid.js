import { google } from 'googleapis';


/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getEmailInfo(auth, Email_id) {
    const gmail = google.gmail({version: 'v1', auth});
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: Email_id,
      format: 'raw'
    });
    const data = res.data
    // console.log("test" + data)

    let parsedEmail
    let paymentInfo = data.raw.split('-')
    paymentInfo.forEach((value, index) => {
    try{
        let decoded = atob(value)
        decoded = decoded.replace(/<\/?[^>]+(>|$)/g, "").trim()
        // console.log(index, " " , decoded)
        parsedEmail += " " + decoded;

    } catch(e){
      console.log(e)
    }
    })
    parsedEmail = parsedEmail.replace(/\s+/g, "").trim();
    let billAmount = parsedEmail.split('$')
    if(billAmount.length == 1) return null
    let finalAmount = "";
    let index = 0;
    while(!/[a-zA-Z]/.test(billAmount[1].charAt(index)) ){
      console.log( billAmount[1].charAt(index))
      if(billAmount[1].charAt(index) != " ") finalAmount += billAmount[1].charAt(index)
      index++
    }
    console.log(finalAmount.charAt(0))
    console.log(finalAmount)
    return finalAmount  
}
  


async function checkforEmail(auth){
    const gmail = google.gmail({version: 'v1', auth})
    const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: '1',
        q: "from:nationalgrid@emails.nationalgridus.com" 
    })
    const labels = res.data.messages
    if (!labels || labels.length === 0) {
        console.log('No labels found.');
        return;
      }
    labels.forEach((lable) => {
        getEmailInfo(auth, lable.id)
    })
}

async function checknewEmail(auth, CURRENTID){
    return;
    const gmail = google.gmail({version: 'v1', auth})
    try{
      const res = await gmail.users.messages.list({
          userId: 'me',
          maxResults: '1',
          q:  "from:nationalgrid@emails.nationalgridus.com"  
      })
      if(res.length == 0 || res.data.messages == undefined) return;
      const lable = res.data.messages
      // console.log(res.data)
      if(!lable) {
          console.log('No labels found.');
          return;
      }
      const id = lable[0].id
      if(id !== CURRENTID){ 
        CURRENTID = id;
        const balance = await getEmailInfo(auth, id) 
        if(balance == null) return;
        return {balance: balance, id:id}
      }    
    } catch (err) {
      console.log(err)
    }
}

async function onStart(auth){
  const gmail = google.gmail({version: 'v1', auth})
  const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: '1',
      q: "from:nationalgrid@emails.nationalgridus.com"
  })
  // if(res.length == 0 || res.data.messages == undefined) return;
  const lable = res.data.messages[0].id
  if(!lable) {
      console.log('No labels found.');
      return;
  }

  return lable;

}

export {checkforEmail, onStart, checknewEmail}