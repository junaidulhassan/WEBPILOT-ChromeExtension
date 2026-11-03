INVALID_PDF = """
    Please Show this Error message in easy way to user if user Ask any question about context.
    Sorry cannot Load PDF File because of Invalid PDF file Location format or non-pdf file.
    Please Try again with different pdf file.
"""

EMPTY_PDF = """
    Please Show this Error message in easy way to user if user Ask any question about context.
    This file may be a scanned PDF or it could be empty, meaning there is no data available.
    Please try again with a PDF that contains text data and is not just a scanned image.
"""

NO_ENGLISH_TRANSCRIPT = """
    Please Show this Error message in easy way to user if user Ask about context or video context.
    We could not retrieve a transcript for the requested video URL. This is likely due to the following reasons:
    No transcripts were found for any of the requested language codes: ['english'].
    As a result, this video does not have an English transcript. To chat about the video, you must have a transcript available in English.
"""

EMPTY_TRANSCRIPT = """
    Please Show this Error message in easy way to user if user Ask about context or video context.
    Sorry I can't describe this video because We couldn't retrieve the transcript for this video.This might be because the video doesn't have subtitles or transcripts in English.
    Please check if the video includes an English transcript and try again.
"""

INVALID_OR_UNAVAILABLE_VIDEO = """
    Please Show this Error message in easy way to user if user Ask about context or video context.
    Sorry, this YouTube link doesn't look valid, or the video is unavailable/private, so we
    couldn't retrieve its transcript. Please check the link and try again.
"""

WARNING_INVALID_PDF = "Couldn't open this PDF. Check that the link points to a valid PDF file."
WARNING_EMPTY_PDF = "This PDF has no readable text. It may be a scanned image."
WARNING_NO_ENGLISH_TRANSCRIPT = "No English transcript is available for this video."
WARNING_EMPTY_TRANSCRIPT = "This video's transcript is empty."
WARNING_INVALID_VIDEO = "This YouTube link is invalid or the video is unavailable."
