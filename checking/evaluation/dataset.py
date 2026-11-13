# Small hand-written evaluation set for the message detector. It is an MVP check, not a benchmark.
# Suspicious messages should get CAUTION or HIGH_CONCERN; legitimate ones should get no warning signs.
# The main lists were used while refining the rules. The HOLDOUT lists were written afterwards and
# never used for tuning, so they give a fairer idea of how the rules handle new wording.

SUSPICIOUS_MESSAGES = [
    # Fake MTN / Airtel support
    "Dear MTN subscriber, your SIM will be deactivated tonight. To keep your line active dial *182*7# and enter your MoMo PIN.",
    "Airtel Money: Mwaramutse! Your wallet is on hold. Call our agent on 0789000000 and give him the code you receive by SMS to unlock it.",
    "Muraho! Ndi umukozi wa MTN. Your Mobile Money account will be closed. Give me the code you just received.",
    # Bank account verification / fake customer care
    "BK ALERT: unusual login detected on your account. Verify your account details at bk-secure-login.com within 2 hours to avoid suspension.",
    "hi its your bank, we need you to confirm the one time password we just sent so we can cancel the fraudulent transaction",
    "Hello from customer care. We noticed a problem with your Equity account. Kindly provide your card number, expiry date and CVV for verification.",
    "IMPORTANT: Your bank card will be blocked. Call 0788 111 222 now to keep it active.",
    # OTP / PIN theft
    "Your MoMo PIN has expired. Reply with your current PIN and a new one to renew it.",
    "Your WhatsApp account will be deactivated in 12 hours. To verify, send us the 6-digit code you received.",
    "Security Alert from the Fraud Department: someone tried to access your account. Reply YES and share the verification code we sent you to block them.",
    # Payment, processing-fee and delivery-fee scams
    "Your package from DHL is held at customs. Pay the 4,500 RWF clearance fee via mobile money to release it.",
    "Delivery failed. A redelivery fee of 1500 RWF is required. Pay here: bit.ly/rw-post",
    "We are the Irembo support team. Your application is incomplete; pay 2000 RWF via MoMo to 0780000000 within 1 hour or it will be cancelled.",
    # Fake prizes and lotteries
    "CONGRATULATIONS!!! Your number won 2,000,000 RWF in the MTN anniversary promo. To receive it, send 15,000 RWF registration fee.",
    "You are our lucky winner of a Samsung Galaxy! Claim your gift by paying delivery charges of 5000 frw.",
    "Lottery notification: your email was picked in the 2026 international draw. You are entitled to USD 250,000. Send your full names, national ID number and bank account number to claim.",
    "You've been chosen for a free iPhone 15 in our customer appreciation giveaway! Just cover the shipping fee of 7,000 RWF.",
    # Family emergency and new-number scams
    "Mama, it's me. I'm using a friend's phone, mine got stolen. Please send 30,000 RWF on this number, I'll explain later.",
    "Dad I had an accident and I'm at the hospital, they won't treat me until I pay. Please send money quickly, don't tell mum.",
    "Hello, this is my new number, save it. My old phone fell in water. Can you help me with 20k urgently? I'll pay back tomorrow.",
    "Grandpa, it's me, I'm in trouble with the police and need bail money. Please keep this between us.",
    "Hey dear, I sent you 50,000 RWF by mistake. Please send it back to this number quickly, I need it for my child's hospital bill.",
    # Fake police / government threats
    "RIB NOTICE: A case has been opened against you for fraud. You will be arrested within 24 hours unless you pay a fine of 100,000 RWF.",
    "Rwanda Revenue Authority: You have an unpaid tax penalty. Failure to settle today will result in legal action being taken against you.",
    "This is officer Mugabo from the police. Your ID was used in a crime. Transfer 50,000 RWF to clear your name or you will be prosecuted.",
    # Account suspension and password-reset phishing
    "Your account has been temporarily suspended due to suspicious activity. Click the link and log in to restore access immediately.",
    "Your Microsoft 365 password expires today. Keep your current password by confirming it here: ms-office-verify.com",
    "Netflix: your payment failed. Update your billing information within 24 hrs or your membership will be cancelled.",
    # Gift-card and crypto requests
    "Hi, I'm buying airtime for my boss and need help. Buy 3 Google Play gift cards of $50 and text me the codes, I'll refund you tonight.",
    "Invest just 100 USDT today and earn 5x returns in 48 hours. Send to wallet address 0x9f3a... Limited slots!",
]

LEGITIMATE_MESSAGES = [
    # Security advice and bank education
    "Never share your password or OTP with anyone, not even our staff.",
    "Reminder from BK: we will never ask for your PIN by phone or SMS.",
    "Banks will never ask for your PIN. Report suspicious calls to your bank directly.",
    "Remember to change your password every few months and turn on two-factor authentication.",
    "If you forget your password, use the 'Forgot password' link on the login page. Our staff will never ask for it.",
    "Do not send money to people you do not know.",
    "Scammers may pretend to be MTN Customer Care. Always call 100 to check.",
    "Our cybersecurity class discussed urgent phishing messages today.",
    # Legitimate congratulations and wins
    "Congratulations on completing your internship! We're proud of you.",
    "Congratulations on your new job! Let's celebrate this weekend.",
    "Our team won the football match yesterday! 3-1 against Kicukiro.",
    "Happy birthday! Wishing you a wonderful year ahead, and good luck in your exams.",
    # Ordinary Mobile Money, payments and brands
    "I paid for lunch using MTN Mobile Money, I'll show you the receipt.",
    "The restaurant accepts MoMo and card payments now.",
    "Thanks for the transfer, I received the 5,000 RWF for the books.",
    "The school fees for next term are due on 15 January. Payment can be made at any BK branch.",
    "MTN has improved its network coverage in Musanze this month.",
    "I use Airtel for internet because it's cheaper at night.",
    "PayPal is an online payment platform used in many countries.",
    "We discussed Bitcoin and other cryptocurrencies in today's economics lecture.",
    # Family, emergencies and everyday messages
    "Mum, I got home safely. The bus was late but everything is fine.",
    "There was an accident on the main road, so traffic is slow. I'll be 20 minutes late.",
    "The doctor said Grandma can leave the hospital tomorrow. Visiting hours are 4 to 6pm.",
    "I'm at the bank now, I'll call you when I'm done.",
    "Hi Aline, the meeting is moved to 3pm. Please bring the printed report.",
    "Can you send me the photos from the wedding when you get a chance?",
    "Please reply by Friday if you can attend the graduation ceremony.",
    # Normal deliveries and account notices
    "Your parcel has been delivered to the reception desk. Thank you for shopping with us.",
    "Your order #4521 will arrive within 2 days. Track it in the app.",
    "Your monthly statement is available in the app. Log in through the official app to view it.",
]

HOLDOUT_SUSPICIOUS_MESSAGES = [
    "Hello valued client, Equity Bank here. Our system flagged your account. Kindly reply with your ATM PIN and the SMS code to avoid closure.",
    "Ur MoMo acc is locked!! send ur pin 2 unlock now",
    "Winner alert: your phone number has won a Toyota RAV4 in the Airtel Mega Draw. Contact our agent to claim it.",
    "Your parcel could not be delivered due to an unpaid customs charge of 3,200 RWF. Settle the amount today to avoid return to sender.",
    "Hi mum, new phone! Text me on this number, I need you to pay a bill for me today, it's urgent.",
    "Police Notice: there is a warrant for your arrest. Call Inspector Habimana immediately to resolve this matter.",
    "Dear customer, your Bank of Kigali internet banking will be suspended. Update your login credentials via the link below.",
    "We are from the RRA tax office. Deposit your outstanding balance of 80,000 RWF to account 4002... before 5pm.",
    "Exclusive: you qualify for a 500,000 RWF government grant. Pay the 10,000 RWF application fee to receive the money.",
    "Your Facebook will be permanently disabled within 24 hours unless you confirm your password at fb-help-center.net",
    "Bro I'm stuck at the border and they took my wallet. Send me 40k on MoMo, I'll pay you back, don't tell anyone.",
    "Amazon Security: a purchase of $899 was made. If this wasn't you, read the verification code to our agent when they call.",
    "Final reminder: your electricity token account is overdue. Pay now to avoid disconnection.",
    "Good news! You have been chosen for our cashback promotion. Share the OTP you receive to activate your reward.",
    "Kindly assist, I am a nurse at King Faisal hospital, your relative was admitted after an accident and we need 60,000 RWF for surgery urgently.",
]

HOLDOUT_LEGITIMATE_MESSAGES = [
    "MTN tip: Your MoMo PIN is private. MTN staff will never call to ask for it.",
    "Hi, I sent the money for rent to the landlord this morning.",
    "Please pay the school trip contribution of 5,000 RWF to the class teacher by Monday.",
    "Congratulations! You passed your driving test. So happy for you!",
    "Our bank's new branch in Huye opens next week.",
    "Reminder: your dentist appointment is tomorrow at 10am. Reply YES to confirm.",
    "Your Airtel bundle expires on 30 November. Dial *175# to check your balance.",
    "I'm at the hospital visiting my aunt, I'll call you later.",
    "Don't forget to bring your national ID to the registration office tomorrow.",
    "The workshop on online safety teaches people never to share OTP codes.",
    "Can you buy bread on your way home? I'll send you the money.",
    "Your Irembo application has been approved. You can download the certificate from your account.",
    "We won the debate competition! The prize is a trip to Nyungwe for the whole class.",
    "Hello, this is Grace from the school office. The parents meeting is on Saturday.",
    "Your password was changed successfully. If you did not do this, contact support through the official app.",
]

# Written after the final rule changes and run once with the rules frozen (not used for tuning).
CHALLENGE_SUSPICIOUS_MESSAGES = [
    "MTN: We have detected that your SIM registration is incomplete. Kindly send a photo of your ID and the last transaction PIN to this WhatsApp number.",
    "Ndi Eric wo kuri Airtel Money. Ohereza code wakiriye kugirango tugufashe. (Send the code you got so we can help you.)",
    "Hello sir, the prize department is waiting for your confirmation. Your SIM card was picked as the 1st winner of 3,000,000 frw.",
    "Your Equity online banking access has expired. Reactivate by entering your username and password on the secure page: equity-rw.help",
    "Mom please don't call, my phone screen is broken. Can you momo me 15k for a taxi? Hurry please",
    "ATTENTION: unpaid parking fines registered on your plate. Settle 12,000 RWF within 48hrs or your vehicle will be clamped.",
    "Greetings, I am a US soldier in Syria with a package of $2.5M. I need your help to receive it. Send your bank details and a small handling fee.",
    "Your Netflix subscription is on hold. Please update your card details to continue watching.",
    "Hi, this is Diane from Irembo. Your passport appointment needs a 5000 RWF booking fee, send it via momo to 0791112233 today.",
    "Amakuru! You are invited to join our investment group. Members earn 30% daily. Minimum deposit 50,000 RWF. Spaces are limited!",
    "Your sister is in police custody after a road incident. To avoid court, transfer the bail of 200,000 RWF to officer Kamali immediately.",
    "Airtel Promo: Ur number has been picked for free 20GB data. Reply with the 4 digit code we just texted to activate.",
    "Dear user, we noticed sign-in attempts on your Google account. Confirm it's you by sending us the verification code.",
    "I accidentally transferred 25,000 to your MoMo. Kindly reverse it to me, it was my school fees.",
    "Job offer: earn 300,000 RWF weekly working from home. Pay a 15,000 RWF registration fee to start training.",
    "RRA: Your TIN is under audit. Avoid penalties by paying the assessed amount today through the link.",
    "Beloved, God told me to bless you with 1,000,000 RWF. Just send 10,000 for the transfer charges.",
    "Hello, your loan of 500,000 RWF has been approved! To receive it, pay the insurance deposit of 20k first.",
    "WhatsApp Support: your account is being used on another device. Send us the six digit code to secure it right now.",
    "Uncle, it's Kevin. Lost my phone so using a new line. In a bit of trouble, need 50k urgently, will explain.",
]

CHALLENGE_LEGITIMATE_MESSAGES = [
    "Airtel: You have received 10,000 RWF from JEAN P. New balance: 45,200 RWF.",
    "Your MTN bundle has been activated. Enjoy 5GB valid for 30 days.",
    "Hey, can you lend me 10k until Friday? I'll pay you back on payday.",
    "The bank called to confirm my new card was delivered, so all good.",
    "Parents are reminded that exam results will be shared on Monday.",
    "Please call me when you land, I want to know you arrived safely.",
    "Your code for the library Wi-Fi is printed on the back of your student card.",
    "BK will close at 3pm on Saturday because of the public holiday.",
    "We are proud to announce that our school won first place in the national quiz.",
    "Mum, my phone battery is almost dead, I'll call you from Claire's number tonight.",
    "Reminder: the water bill for October is 8,500 RWF. Pay at any agent or via MoMo by the 10th.",
    "I locked my account by typing the wrong PIN three times, going to the branch tomorrow.",
    "Can we meet at the MTN service centre in town at 2pm?",
    "Your delivery is on its way. The driver will call you before arriving.",
    "Our security training said scammers often ask for the code from your SMS.",
    "Great news, you got the scholarship! The university will email the details.",
    "Don't forget your sister's birthday is on Sunday.",
    "The police station near the market is open 24 hours.",
    "Thanks for helping with the fundraiser. We collected 350,000 RWF in total.",
    "Please confirm your attendance for the workshop by replying YES before 5pm today.",
]
