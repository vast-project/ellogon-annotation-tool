<?php

class OpenDocumentController extends \BaseController {

	public function index() {
		try {
			$user = Sentinel::getUser();
			return Response::json(array(
									'success' => true,
									'data'	  => DB::table('open_documents')
								  				   ->leftJoin('shared_collections', 'open_documents.collection_id', '=', 'shared_collections.collection_id')
												   ->select(DB::raw('open_documents.collection_id, open_documents.document_id, open_documents.annotator_type, open_documents.db_interactions, shared_collections.confirmed, IF('.$user['id']. '=open_documents.user_id, true, false) as opened'))
										           ->get()));
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}
	}


	public function show($document_id) {
		try {
			$user = Sentinel::getUser();
			return Response::json(array(
									'success' => true,
									'data'	  => DB::table('open_documents')
								  				   ->leftJoin('shared_collections', 'open_documents.collection_id', '=', 'shared_collections.collection_id')
												   ->where('open_documents.document_id', $document_id)
												   ->select(DB::raw('open_documents.collection_id, open_documents.document_id, open_documents.db_interactions, shared_collections.confirmed, IF('.$user['id']. '=open_documents.user_id, true, false) as opened'))
										           ->get()));
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}
	}

	//open a document
	public function store() {
		try {
			$input = Input::get('data');
			$user = Sentinel::getUser();

			$db_interactions = 0;
			$open_docs = OpenDocument::where('user_id', $user['id'])			//before insert a new record empty the open document table 
									 ->where('collection_id', (int)$input['collection_id'])
									 ->where('document_id', (int)$input['document_id'])
									 ->first();

			if(sizeof($open_docs)>0)
				$db_interactions = $open_docs['db_interactions'];

			OpenDocument::where('user_id', $user['id'])			//before insert a new record empty the open document table 
						->delete();

			$open_document = new OpenDocument;
			$open_document->user_id = $user['id'];
			$open_document->collection_id = $input['collection_id'];
			$open_document->document_id = $input['document_id'];
			$open_document->annotator_type = $input['annotator_type'];
			$open_document->db_interactions = $db_interactions;
			$open_document->save();
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}

	//close a document
	public function destroy($document_id) {
		try {
			$user = Sentinel::getUser();
			OpenDocument::where('user_id', $user['id'])
						->where('document_id', (int) $document_id)
						->delete();
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}
}
