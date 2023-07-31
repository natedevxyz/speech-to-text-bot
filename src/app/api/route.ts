import { NextRequest, NextResponse } from 'next/server';

const apiToken = process.env.ASSEMBLYAI_API_KEY;

export async function POST(req: NextRequest, res: NextResponse) {
	const data = await req.formData();
	const audioFile: File | null = data.get('file') as unknown as File;

	if (!audioFile) {
		return NextResponse.json({ success: false, message: 'No file provided.' });
	}

	const bytes = await audioFile.arrayBuffer();
	const buffer = Buffer.from(bytes);

	console.log(`Uploading file`);
	const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
		method: 'POST',
		body: buffer,
		headers: {
			'Content-Type': 'application/octet-stream',
			Authorization: apiToken!,
		},
	});

	const uploadData = await uploadResponse.json();
	const audioUrl = uploadData['upload_url'];
	console.log(`File uploaded`);

	const transcriptionHeaders = {
		authorization: apiToken!,
	};

	console.log('Transcribing audio... This might take a moment.');
	const transcriptionResponse = await fetch(
		'https://api.assemblyai.com/v2/transcript',
		{
			method: 'POST',
			body: JSON.stringify({ audio_url: audioUrl }),
			headers: transcriptionHeaders,
		}
	);

	const transcriptionData = await transcriptionResponse.json();
	const transcriptId = transcriptionData.id;
	let body;

	while (true) {
		const pollingResponse = await fetch(
			`https://api.assemblyai.com/v2/transcript/${transcriptId}`,
			{
				headers: transcriptionHeaders,
			}
		);
		const transcriptionOutput = await pollingResponse.json();

		if (transcriptionOutput.status === 'completed') {
			body = transcriptionOutput;
			console.log(`File transcribed`);
			return NextResponse.json({ output: body });
		} else if (transcriptionOutput.status === 'error') {
			throw new Error(`Transcription failed: ${transcriptionOutput.error}`);
		} else {
			await new Promise(resolve => setTimeout(resolve, 3000));
		}
	}
}
