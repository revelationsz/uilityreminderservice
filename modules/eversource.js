import { google } from 'googleapis';

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
const getEmailInfo = async function(auth, Email_id) {
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
    // if(billAmount.length == 1) return null
    let finalAmount = "";
    let index = 0;
    while(/[0-9.]/.test(billAmount[1].charAt(index)) ){
      console.log( billAmount[1].charAt(index))
      if(billAmount[1].charAt(index) != " ") finalAmount += billAmount[1].charAt(index)
      index++
    }
    console.log("final amount" + finalAmount)
    return finalAmount  
  }
  
  
  
const checkforEmail = async function(auth){
      const gmail = google.gmail({version: 'v1', auth})
      const res = await gmail.users.messages.list({
          userId: 'me',
          maxResults: '1',
          q: "from:noreply@notifications.eversource.com" 
      })
      const labels = res.data.messages
      console.log(labels); 
      if (!labels || labels.length === 0) {
          console.log('No labels found.');
          return;
        }
      labels.forEach((lable) => {
          getEmailInfo(auth, lable.id)
      })
  }
  
  async function checknewEmail(auth, CURRENTID){
      const gmail = google.gmail({version: 'v1', auth})
      try{
        const res = await gmail.users.messages.list({
          userId: 'me',
          maxResults: '1',
            q:  "from:noreply@notifications.eversource.com" 
        })
        if(res.length == 0 ||  res.data.messages == undefined) return;
        const lable = res.data.messages
        console.log("lable" + lable)
        if(!lable) {
            console.log('No labels found.');
            return;
        }
        const id = lable[0].id
        // if(id !== CURRENTID){ //we have a new email than current one in db
          CURRENTID = id;
          const into = await getEmailInfo(auth, id) 
          if(into == null) return;
          // console.log(into)
          // const info = into.split('$')
          // const balance = info[1].split(' ')[0]
          return {balance: into, id:id}
        // }    
      } catch (err) { 
        console.log(err)
      }
    
  }
  
  async function onStart(auth){
    const gmail = google.gmail({version: 'v1', auth})
    const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: '1',
        q: "from:noreply@notifications.eversource.com" 
    })
    // if(res.length == 0 || res.data.messages == undefined) return;
    const lable = res.data.messages[0].id
    if(!lable) {
        console.log('No labels found.');
        return;
    }

    return lable

  }


export {checkforEmail, onStart, checknewEmail}